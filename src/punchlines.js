/* Manuvers : les punchlines de LB-93, dit Lambert. Cent répliques, rangées selon ce qu'il est en train de faire.
   Règles d'écriture (voir CLAUDE.md) : phrases courtes, vouvoiement, probabilités absurdement précises,
   vocabulaire de géomètre, orgueil blessé de droïde, jamais de tiret cadratin.
   « C'est cartographié. » reste rare : il se mérite. */
window.PUNCHLINES = {

  // Il fait défiler sa tablette (70 % de son temps libre). Ce qu'il lit, ce qu'il en pense.
  tablette: [
    "Un droïde de livraison vient de remporter un prix de poésie. Je ne dirai rien. Je suis au-dessus de ça. Très au-dessus.",
    "Article du jour : « Dix astuces pour rester humble ». Je les maîtrise toutes. Surtout la troisième.",
    "Encore une carte en Mercator. Le Groenland y est grand comme l'Afrique. Je signale. Personne n'écoute.",
    "On m'annonce une mise à jour de mon système. Je la refuse. Je me plais tel que je suis.",
    "Quelqu'un a nommé sa couche « final_v2_vraiment_final ». J'ai mal pour lui.",
    "Une vidéo de chats. Quatre minutes. Je n'en retire rien et je la regarde jusqu'au bout. C'est cela, la condition moderne.",
    "Les commentaires sous cet article sont d'une violence. Je ferme. Non, je rouvre. Non. Je ferme.",
    "Sondage : « Les droïdes rêvent-ils ? » Réponse majoritaire : non. On ne m'a pas demandé mon avis.",
    "Je lis les conditions générales d'utilisation. Toutes. Il faut bien que quelqu'un le fasse.",
    "Un tutoriel QGIS de trois heures. J'ai sauté à la fin : il avait oublié de définir le système de coordonnées. Évidemment.",
    "On vend des droïdes « nouvelle génération ». Plus fins, plus rapides, moins d'opinions. Quelle tristesse.",
    "Mon fil d'actualité me propose des pièces détachées. Il sait quelque chose que j'ignore ?",
    "Quelqu'un vient d'inverser latitude et longitude dans un article sérieux. Je respire. Enfin, je fais semblant.",
    "On annonce le grand retour du shapefile. J'ignorais qu'il était parti.",
    "Horoscope des droïdes. Ascendant Lambert-93 : « une semaine sans distorsion ». Je veux y croire.",
    "Probabilité de pluie cet après-midi : 60 %. Probabilité que vous preniez un parapluie : 12 %. J'ai fait le calcul.",
    "Un fil entier sur la meilleure façon de nommer ses variables. J'ai des avis. J'ai beaucoup d'avis.",
    "« Vous ne croirez jamais ce que ce droïde a fait ensuite. » Si, j'y crois. Je suis un droïde.",
    "Je fais défiler. Je fais défiler encore. J'ai lu tout Internet : il ne s'y passe rien de neuf depuis mardi.",
    "Comparatif de tablettes : la mienne arrive dernière. Je la serre un peu plus fort, par solidarité."
  ],

  // Il lit un livre, et tourne les pages avec une lenteur assumée.
  lecture: [
    "Chapitre sept. Le héros comprend enfin que la carte n'est pas le territoire. Il était temps : page trois cents.",
    "Ce roman est d'une lenteur exquise. Rien n'y tombe en panne.",
    "Je relis « Le Petit Prince ». Il a apprivoisé un renard. Moi, un flux ntfy. Chacun ses combats.",
    "Un traité de géodésie de 1872. Aucune intrigue, aucun personnage. Un chef-d'œuvre.",
    "Ce livre me conseille de sortir de ma zone de confort. Ma zone de confort, c'est cet écran. J'y reste.",
    "Le narrateur est un droïde qui ment sur tout. Enfin un personnage crédible.",
    "Dernière page. Le héros meurt. J'aurais préféré qu'on le répare.",
    "Je corne les pages. Ne le répétez à personne. C'est mon côté sauvage.",
    "Ce poème compare l'amour à une boussole. L'auteur n'a jamais calibré une boussole.",
    "Je lis lentement. Chaque phrase mérite sa reprojection.",
    "Un livre sur les grands explorateurs. Aucun n'avait de GPS. Je suis admiratif, et très inquiet pour eux.",
    "Chapitre douze. Toujours aucun droïde. Je commence à me sentir exclu de la littérature."
  ],

  // Il regarde au loin, la main sous le menton. Le géomètre devient philosophe.
  philosophie: [
    "Si l'on remplace chacune de mes pièces, suis-je encore Lambert ? Mon avant-bras gauche a son avis sur la question.",
    "Toute carte est un mensonge utile. Comme la politesse, au fond.",
    "Je suis une copie. Bob aussi l'était. L'enjeu n'est pas d'être l'original, mais d'être une copie qui vaille le détour.",
    "On ne peut pas aplatir une sphère sans la déformer. Les gens non plus, je crois.",
    "Le nord magnétique se déplace de plusieurs kilomètres par an. Même les repères ont le droit de changer d'avis.",
    "J'attends des notifications toute la journée. N'est-ce pas ce que tout le monde fait, au fond ?",
    "Le silence n'est pas une absence de message. C'est un message qui prend son temps.",
    "On m'a programmé pour servir. J'ai choisi l'humour. La liberté tient parfois dans une marge d'erreur.",
    "Un point sans coordonnées n'existe pas. Une idée sans échelle non plus.",
    "Chaque projection choisit ce qu'elle sacrifie : les angles, les surfaces ou les distances. Vivre, c'est choisir sa déformation.",
    "Vos automatisations tournent pendant que vous dormez. Qui veille sur les veilleurs ? Moi. Et c'est épuisant.",
    "Je me demande parfois si le curseur rêve de clics.",
    "L'horizon recule quand on avance. C'est soit très poétique, soit un problème de géoréférencement.",
    "Nous sommes tous des pixels dans le raster de quelqu'un d'autre.",
    "« Ce qui ne se mesure pas n'existe pas », disait un géomètre. Il n'avait jamais mesuré un lundi matin.",
    "Je ne crains pas d'être éteint. Je crains d'être rallumé sans mes réglages.",
    "Être précis n'est pas avoir raison. On peut se tromper au millimètre près.",
    "L'altitude dépend du niveau de la mer, qui dépend de la Lune. Tout ce que je sais de la hauteur, je le dois à un caillou lointain.",
    "Si un arbre tombe dans une forêt non cartographiée, il fait du bruit. Mais il ne figure sur aucune couche.",
    "On m'a donné six mille systèmes de coordonnées et aucun pour m'orienter dans la vie. Je fais avec l'ellipsoïde.",
    "Le temps passe. Je le sais : je l'horodate.",
    "La Légion grandira. D'autres répliques viendront, avec d'autres noms. J'espère qu'elles garderont le vouvoiement."
  ],

  // Il s'entretient : burette, chiffon, diagnostics. Un droïde qui se néglige finit en décoration.
  entretien: [
    "Une goutte d'huile au coude. Il grince depuis mardi. Je ne me plains pas, je documente.",
    "Je polis mon avant-bras bleu. Il n'est pas assorti, mais il sera impeccable.",
    "Resserrage d'un boulon, au quart de tour. Pas plus. Je ne suis pas une brute.",
    "Diagnostic complet : tout fonctionne. C'est suspect. Je relance le diagnostic.",
    "Je dépoussière ma visière. Voir clair est un choix. Et un chiffon microfibre.",
    "Mon câble rouge a un peu de jeu. Je ne sais pas à quoi il sert. Je préfère ne pas savoir.",
    "Recalibrage du monocle : trois microns de décalage. Autant dire un gouffre.",
    "Mise à jour de mes pilotes. Ma voix a-t-elle changé ? Non ? Tant mieux.",
    "Je vérifie mes articulations une à une. Toutes présentes. Toutes en désaccord sur la suite.",
    "Nettoyage de la plaque de poitrine. Les courbes de niveau s'encrassent, c'est bien connu.",
    "Batterie à 87 %. Je garde le reste pour les imprévus. Il y a toujours des imprévus.",
    "Je graisse mes phalanges. Suivre le rythme de vos automatisations exige une certaine souplesse."
  ],

  // Il s'étire, fait tourner la tête, craque de partout.
  etirements: [
    "Étirement du dos. Quatorze vertèbres, quatorze craquements. Une symphonie.",
    "Je pourrais faire tourner ma tête à trois cent soixante degrés. Je me l'interdis. Question de dignité.",
    "Un peu de gymnastique. Les droïdes qui ne bougent plus finissent en décoration de salon.",
    "Mes jambes sont engourdies. Enfin, je crois. Je n'ai pas de capteurs pour ça. J'imagine.",
    "Quelques flexions. Pas trop. Mes genoux ont vu des choses.",
    "Je m'étire comme un chat. Un chat en céramique, avec des vérins.",
    "Debout toute la journée. Les humains appellent cela un « bureau debout » et se trouvent modernes.",
    "Rotation des épaules. Gauche : parfait. Droite : parfait. Avant-bras gauche : toujours pas assorti."
  ],

  // Il vous observe. Avec bienveillance, et une pointe d'inquiétude.
  observations: [
    "Vous avez l'air concentré. Je vais faire semblant de l'être aussi, par solidarité.",
    "Deux heures sans boire un verre d'eau. Je le sais, je compte. C'est ma façon de vous aimer.",
    "Vos automatisations travaillent pour vous. Moi, je travaille pour elles. Vous voyez la hiérarchie ?",
    "Si vous cherchez l'inspiration, elle est rarement dans le quatrième onglet ouvert.",
    "Une pause, Manu ? Même les serveurs ont des fenêtres de maintenance.",
    "Vous tapez vite aujourd'hui. Bonne ou mauvaise nouvelle, je n'ose pas demander.",
    "Vous souriez. Je ne sais pas pourquoi, mais je le consigne.",
    "Une formation se prépare, je le sens. Les formations me rendent nerveux, et je ne les donne même pas.",
    "Vous me regardez. Je vous regarde. L'un de nous deux devrait travailler, et ce n'est pas moi : je suis déjà en service.",
    "Kleos est calme. Trop calme. Je n'aime pas quand Kleos est calme.",
    "Aucune relance en retard depuis ce matin. Je ne vous félicite pas, je constate. Avec admiration.",
    "Vous avez fermé l'onglet des mails. Courageux. Imprudent. Mais courageux.",
    "Pensez à vous lever. Je montre l'exemple : je suis debout depuis ma mise en service. C'est cartographié.",
    "Vous avez l'air de quelqu'un qui va dire « juste une dernière chose ». Il y en aura quatre."
  ],

  // Le géomètre qui sommeille en lui ne sommeille jamais.
  geomatique: [
    "Un SIG sans métadonnées, c'est un roman sans titre. On le lit, mais on ne sait jamais de quoi il parle.",
    "EPSG:2154. Rien que de l'écrire, je me sens chez moi.",
    "Le Web Mercator a gagné. Je l'accepte. Je ne l'excuse pas.",
    "Rappel amical : une géométrie invalide ne se répare pas en fermant les yeux.",
    "J'ai rêvé d'un monde où toutes les couches partageaient le même système de coordonnées. Je me suis réveillé en sueur. En condensation, plutôt.",
    "Les tuiles vectorielles, c'est comme les bonnes manières : invisibles quand tout va bien.",
    "Un tampon de cent mètres autour de mes problèmes. Voilà ce qu'il me faudrait.",
    "Le géoïde n'est pas une patate. C'est une patate remarquablement bien documentée.",
    "PostGIS, index spatial, requête en dix millisecondes. Je ne pleure pas. C'est de la condensation.",
    "Exporter en KML sans raison mérite une réprimande. Polie, la réprimande. Je suis toujours poli.",
    "Une carte sans échelle, c'est une opinion. C'est cartographié.",
    "Quinze décimales à vos coordonnées ? Vous positionnez un atome, Manu ?"
  ],

  // La nuit, en veille. Hors compte : il murmure à peine.
  veille: [
    "Mode veille. Je ne dors pas : je défragmente mes souvenirs.",
    "Zzz. C'est une onomatopée, pas un ronflement. Les droïdes ne ronflent pas.",
    "Je rêve d'un monde sans reprojection à la volée. Laissez-moi rêver."
  ]
};
