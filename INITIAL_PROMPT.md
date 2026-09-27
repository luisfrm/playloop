Necesito crear una aplicacion web de juegos de futbol principalmente. Necesitamos un panel para gestionar el contenido de estos juegos. El primer juego sera llamado "Adivina el estadio", pero toda esta informacion sera customizable, realmente los juegos seran por tipos, aca el primer tipo:

## True/False 

Se basa en imagenes de estadios, cada juego tiene su tematica, podria por ejemplo haber, adivina los estadios de primera division inglesa. Y asi sucesivamente con otros paises. Tenemos que centralizar la logica, pues aca este juego lo veo como un true-false, dado que el usuario solo debe seleccionar el estadio u opcion, si es correcta pues se le suma un punto y se pasa a otra imagen, si es incorrecta pierde el juego. Pues desde el panel podriamos manejarlo asi: "Nuevo juego" > Tipo de juego: True or False. Aca escogemos las opciones a evaluar, un boton para añadir mas, y en cada opcion tendremos un input para añadir el nombre del estadio y otro para añadir una imagen de ese estadio y otro input de text area para agregar descripcion. claro esta debemos permitir subir imagenes y se hara a un bucket de R2. Pienso que las subidas pueden ser con presigned-urls o con binding. 

Lo siguiente es poder configurar los ajustes del juego, por ejemplo si es True False, podremos decir si es modo clasico o modo experto. Modo clasico es el que acabo de describir, modo experto es que el usuario tenga que escribir el nombre y nosotros validemos si es correcto. Ademas podremos configurar el tiempo limite para resolver el juego, el tiempo limite para cada pregunta y el numero de vidas que tiene el jugador. Todo esto sera customizable. Lo ideal es que esto sea centralizado de manera que podamos crear muchos juegos, o hacer nuevos despliegues de distintas tematicas, por ejemplo quiero hacer juegos para KPop y crear un juego true/false de cantantes actuales de Kpop, de esta forma no nos limitaria a hacer otro despliegue en cloudflare de una tematica totalmente distinta pero usando la misma logica. Este sera el primer juego, necesitamos logica centralizada, que permita crear nuevos juegos facilmente, desde el panel podemos crear nuevos juegos basado en los tipos actuales, el primer juego sera true/false. 


## Modo de juego

Tendremos modo 1 jugador (No requiere login) y modo online, aca solo requiere que se ingrese un nombre para mostrarlo en el ranking y esto generara tecnicamente como un usuario efimero para guardar su puntuacion, de esta manera no hay datos sensibles y cualquiera puede jugar. Tambien tendremos partidas cooperativas, de manera que distintos jugadores puedan unirse mediante un codigo de sala. Se supone que desde las settings, al menos en configuracion del juego, cada type tendra sus settings como dijimos, entre las de true/false esta tambien tiempo de seleccion, en este tiempo el jugador actual tiene que escoger una opcion sino perdera una vida. Habra settings para el modo coop y single.

No te limites a mi idea, si tienes otra idea de como podria ser este juego, sugierela.

Utiliza las mejores practicas para React Router V8, que sera nuestra app. Aca quiero logica sencilla, nada de sobre ingenieria, de hecho usa lo basico y necesario para mantener un codigo legible y mantenible teniendo en cuenta que este proyecto sera multiproposito, no solo una app de juegos de futbol. Quiero que todas las variales de tailwind esten definidas de manera que si queremos cambiar el tema, solo tengamos que tocar las variables de tailwind. Para los UI Components, estos deben entrar dentro de package/ui y manejados mediante variantes, no quiero classname en los componentes importados, salvo que sea para un efecto o algo muy puntual y necesario. Evita importaciones de react-icons, usa lucide-react. Intenta tener todo componetizado, que la complejidad de funciones no pase de 15 que es el maximo permitido. Para los componentes, intenta un componente por modal, un componente por form, y asi, para tener logica mantenible y limpia sin sobrecomplicarnos. Recuerda usar Shadcn UI y sus variantes para los componentes, asegurate de que estas variantes esten listas para ser utilizadas desde el inicio.

Para los loaders, tendremos efectos skeletons. Me gustaria que lo primero que salga sea el input del nombre, quiza un popup, el nombre pues puede guardarse en cache, si existe en cache mostramos el nombre guardado en el input, si no existe pues mostramos el input vacio. En caso de que exista en cache, el usuario podra cambiarlo si desea. Este input estara siempre disponible en cualquier momento desde una opcion a escoger, quiza un boton desde el topnav, un icon user y al tocarlo muestra la info actual del usuario y si desea modificarla.

Para el layout del home, pues tendriamos un
<TopNav Full-W>
<Content>
  <GameList -Grid 4 Columnas->
    <GameCard game={game}/>

Para el panel pues un sidebar con las opciones y implementamos el layout de shadcn para admin. En el sidebar tendremos opciones para gestionar los juegos, por ejemplo: Juegos > Tipos, Estadios, Preguntas y Opciones, etc.  No quiero que pongas toda la logica de una vez, ve por partes.  Primero la estructura del proyecto, las dependencias, el tailwind. Luego crea el layout del panel, luego el layout del home y el topnav, luego el gamelist y el gamecard, y asi poco a poco. No intentes poner todo de golpe, ve poco a poco.

## Tech Stack

# React Router V8, ya implementado V8, que es la version nueva funcionada con Remix
# TypeScript
# TailwindCSS
# Drizzle ORM
# Cloudflare D1
# Cloudflare R2
# Cloudflare KV
# Durable Objects
# Pnpm