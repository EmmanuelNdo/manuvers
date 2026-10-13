// Manuvers : coque native de l'avatar compagnon.
// Le Rust reste volontairement mince : placement de la fenêtre sur le bon écran,
// icône de barre des menus, lancement au démarrage, maintien de l'écran allumé,
// lecture des transcriptions récentes de Claude Code.
// Toute la logique métier (ntfy, animations, réglages) vit dans ../src.
// Exception assumée : ia.rs garde les secrets au trousseau et fait les appels qui en
// ont besoin (API Claude, Kleos), pour qu'aucune clé ne transite par la page.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ia;

use std::process::Child;
use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[derive(Default)]
struct AppState {
    keep_awake: Mutex<Option<Child>>,
}

#[derive(Serialize)]
struct MonitorInfo {
    name: String,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    scale: f64,
    primary: bool,
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main").ok_or_else(|| "fenêtre principale introuvable".to_string())
}

fn monitor_name(m: &Monitor) -> String {
    m.name().cloned().unwrap_or_else(|| "Écran".to_string())
}

/// Liste des écrans branchés, pour le menu de choix dans les réglages.
#[tauri::command]
fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let w = main_window(&app)?;
    let primary = w.primary_monitor().map_err(|e| e.to_string())?.map(|m| monitor_name(&m));
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;
    Ok(monitors
        .iter()
        .map(|m| {
            let name = monitor_name(m);
            MonitorInfo {
                primary: primary.as_deref() == Some(name.as_str()),
                width: m.size().width,
                height: m.size().height,
                x: m.position().x,
                y: m.position().y,
                scale: m.scale_factor(),
                name,
            }
        })
        .collect())
}

/// Applique un mode d'affichage.
/// - "scene" : plein écran sur l'écran demandé, sinon sur le premier écran externe, sinon sur l'écran principal.
/// - "floating" : petite fenêtre transparente, toujours au premier plan, en bas à droite de l'écran principal.
/// Renvoie le nom de l'écran réellement utilisé.
#[tauri::command]
async fn apply_mode(app: AppHandle, mode: String, monitor: Option<String>) -> Result<String, String> {
    let w = main_window(&app)?;
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;
    let primary = w.primary_monitor().map_err(|e| e.to_string())?;
    let primary_name = primary.as_ref().map(monitor_name);

    let target = if mode == "scene" {
        monitor
            .as_ref()
            .and_then(|n| monitors.iter().find(|m| &monitor_name(m) == n).cloned())
            .or_else(|| monitors.iter().find(|m| Some(monitor_name(m)) != primary_name).cloned())
            .or_else(|| primary.clone())
    } else {
        primary.clone()
    }
    .or_else(|| monitors.first().cloned())
    .ok_or_else(|| "aucun écran détecté".to_string())?;

    let pos = *target.position();
    let size = *target.size();
    let scale = target.scale_factor();

    // Sortir du plein écran avant tout déplacement (l'animation macOS dure environ 0,7 s).
    if w.is_fullscreen().unwrap_or(false) {
        w.set_fullscreen(false).map_err(|e| e.to_string())?;
        std::thread::sleep(Duration::from_millis(900));
    }

    if mode == "scene" {
        let _ = w.set_always_on_top(false);
        let _ = w.set_ignore_cursor_events(false);
        let _ = w.set_size(PhysicalSize::new(size.width / 2, size.height / 2));
        w.set_position(PhysicalPosition::new(pos.x + 60, pos.y + 60)).map_err(|e| e.to_string())?;
        w.show().map_err(|e| e.to_string())?;
        std::thread::sleep(Duration::from_millis(250));
        w.set_fullscreen(true).map_err(|e| e.to_string())?;
    } else {
        let ww = (420.0 * scale) as u32;
        let wh = (620.0 * scale) as u32;
        let margin = (24.0 * scale) as i32;
        let bottom = (90.0 * scale) as i32;
        let _ = w.set_size(PhysicalSize::new(ww, wh));
        let _ = w.set_position(PhysicalPosition::new(
            pos.x + size.width as i32 - ww as i32 - margin,
            pos.y + size.height as i32 - wh as i32 - bottom,
        ));
        let _ = w.set_always_on_top(true);
        w.show().map_err(|e| e.to_string())?;
    }
    Ok(monitor_name(&target))
}

/// Mode flottant : laisse passer les clics à travers l'avatar.
#[tauri::command]
fn set_click_through(app: AppHandle, enabled: bool) -> Result<(), String> {
    main_window(&app)?.set_ignore_cursor_events(enabled).map_err(|e| e.to_string())
}

/// Empêche la mise en veille de l'écran (macOS : processus `caffeinate` lié à l'application).
#[tauri::command]
fn set_keep_awake(state: tauri::State<'_, AppState>, enabled: bool) -> Result<bool, String> {
    let mut guard = state.keep_awake.lock().map_err(|e| e.to_string())?;
    if enabled {
        if guard.is_none() {
            #[cfg(target_os = "macos")]
            {
                let pid = std::process::id().to_string();
                let child = std::process::Command::new("/usr/bin/caffeinate")
                    .args(["-d", "-i", "-w", pid.as_str()])
                    .spawn()
                    .map_err(|e| e.to_string())?;
                *guard = Some(child);
            }
        }
    } else if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(guard.is_some())
}

/// Lancement automatique à l'ouverture de session.
#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let launcher = app.autolaunch();
    let current = launcher.is_enabled().unwrap_or(false);
    if enabled && !current {
        launcher.enable().map_err(|e| e.to_string())?;
    } else if !enabled && current {
        launcher.disable().map_err(|e| e.to_string())?;
    }
    launcher.is_enabled().map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct SessionTail {
    project: String,
    id: String,
    mtime_ms: u64,
    tail: String,
}

/// Fin des transcriptions récentes de Claude Code (~/.claude/projects/*/*.jsonl, ou $CLAUDE_CONFIG_DIR/projects).
/// Lecture seule ; l'interprétation (au travail, vous attend, terminé) se fait en JavaScript (src/sessions.js).
#[tauri::command]
async fn claude_sessions(max_age_secs: u64, max_bytes: u64) -> Vec<SessionTail> {
    use std::io::{Read, Seek, SeekFrom};
    let root = std::env::var_os("CLAUDE_CONFIG_DIR")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".claude")))
        .map(|d| d.join("projects"));
    let Some(root) = root else { return vec![] };
    let now = std::time::SystemTime::now();
    let mut found: Vec<(u64, std::path::PathBuf, String, String)> = vec![];
    for proj in std::fs::read_dir(&root).into_iter().flatten().flatten() {
        let project = proj.file_name().to_string_lossy().to_string();
        for f in std::fs::read_dir(proj.path()).into_iter().flatten().flatten() {
            let path = f.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") { continue; }
            let Ok(meta) = f.metadata() else { continue };
            let Ok(modified) = meta.modified() else { continue };
            if now.duration_since(modified).map(|d| d.as_secs() > max_age_secs).unwrap_or(false) { continue; }
            let mtime_ms = modified.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0);
            let id = path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            found.push((mtime_ms, path, project.clone(), id));
        }
    }
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found.truncate(20);
    found
        .into_iter()
        .filter_map(|(mtime_ms, path, project, id)| {
            let mut file = std::fs::File::open(&path).ok()?;
            let len = file.metadata().ok()?.len();
            let start = len.saturating_sub(max_bytes.min(512 * 1024));
            file.seek(SeekFrom::Start(start)).ok()?;
            let mut buf = Vec::new();
            file.read_to_end(&mut buf).ok()?;
            Some(SessionTail { project, id, mtime_ms, tail: String::from_utf8_lossy(&buf).to_string() })
        })
        .collect()
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", "Afficher Manuvers", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "mode-scene", "Mode scène (écran dédié)", true, None::<&str>)?,
            &MenuItem::with_id(app, "mode-floating", "Mode flottant (bureau)", true, None::<&str>)?,
            &MenuItem::with_id(app, "next-monitor", "Passer à l'écran suivant", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "toggle-sound", "Couper ou rétablir le son", true, None::<&str>)?,
            &MenuItem::with_id(app, "test", "Notification de test", true, None::<&str>)?,
            &MenuItem::with_id(app, "settings", "Réglages…", true, None::<&str>)?,
            &MenuItem::with_id(app, "reload", "Recharger l'avatar", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "quit", "Quitter Manuvers", true, None::<&str>)?,
        ],
    )?;

    let mut tray = TrayIconBuilder::with_id("manuvers").tooltip("Manuvers").menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id().as_ref() {
        "quit" => app.exit(0),
        "show" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_ignore_cursor_events(false);
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "reload" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.eval("location.reload()");
            }
        }
        other => {
            if other == "settings" {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.set_ignore_cursor_events(false);
                    let _ = w.set_focus();
                }
            }
            let _ = app.emit("tray", other.to_string());
        }
    })
    .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            list_monitors,
            apply_mode,
            set_click_through,
            set_keep_awake,
            set_autostart,
            ia::cle_claude_enregistrer,
            ia::cle_claude_presente,
            ia::cle_claude_effacer,
            ia::claude_messages,
            ia::kleos_connecter,
            ia::kleos_etat,
            ia::kleos_deconnecter,
            ia::kleos_mcp,
            claude_sessions
        ])
        .setup(|app| {
            build_tray(app)?;
            // Filet de sécurité : si le frontend ne place pas la fenêtre, on l'affiche quand même.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(5));
                if let Some(w) = handle.get_webview_window("main") {
                    if !w.is_visible().unwrap_or(true) {
                        let _ = w.show();
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fermer la fenêtre la masque : Manuvers reste à l'écoute depuis la barre des menus.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Manuvers");
}
