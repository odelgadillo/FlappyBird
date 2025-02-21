const lienzo = document.getElementById("gameCanvas");
const ctx = lienzo.getContext("2d");

// Tamaño del lienzo
lienzo.width = 320;
lienzo.height = 480;

// Variables del juego
let pajaro = { x: 50, y: 150, ancho: 40, alto: 40, gravedad: 0.6, impulso: -8, velocidad: 0 };
let tuberias = [];
let fotograma = 0;
let juegoTerminado = false;
let puntaje = 0;

// Dibuja el pájaro
function dibujarPajaro() {
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(pajaro.x, pajaro.y, pajaro.ancho, pajaro.alto);
}

// Dibuja las tuberías
function dibujarTuberias() {
    ctx.fillStyle = "#008000";
    tuberias.forEach(tuberia => {
        ctx.fillRect(tuberia.x, tuberia.y, tuberia.ancho, tuberia.alto);
    });
}

// Actualiza la posición del pájaro
function actualizarPajaro() {
    pajaro.velocidad += pajaro.gravedad;
    pajaro.y += pajaro.velocidad;


    // Limita el pájaro en la parte superior (sin perder el juego)
    if (pajaro.y < 0) {
        pajaro.y = 0;
        pajaro.velocidad = 0; //Detiene el movimiento hacia arriba
    }   

    // Limita el pájaro dentro del lienzo
    if (pajaro.y + pajaro.alto > lienzo.height) {
        juegoTerminado = true;
    }
}

// Genera tuberías
function generarTuberias() {
    if (fotograma % 120 === 0) {
        let espacio = 120;
        let alturaTuberia = Math.random() * (lienzo.height - espacio);
        tuberias.push({ x: lienzo.width, y: 0, ancho: 40, alto: alturaTuberia });
        tuberias.push({ x: lienzo.width, y: alturaTuberia + espacio, ancho: 40, alto: lienzo.height - alturaTuberia - espacio });
    }
}

// Actualiza las tuberías
function actualizarTuberias() {
    for (let i = tuberias.length - 1; i >= 0; i--) {
        tuberias[i].x -= 1.5;

        // Elimina tuberías que salen de la pantalla
        if (tuberias[i].x + tuberias[i].ancho < 0) {
            tuberias.splice(i, 1);
            puntaje++;
        }

        // Detección de colisiones
        if (
            pajaro.x < tuberias[i].x + tuberias[i].ancho &&
            pajaro.x + pajaro.ancho > tuberias[i].x &&
            pajaro.y < tuberias[i].y + tuberias[i].alto &&
            pajaro.y + pajaro.alto > tuberias[i].y
        ) {
            juegoTerminado = true;
        }
    }
}

// Dibuja el puntaje
function dibujarPuntaje() {
    ctx.fillStyle = "#000";
    ctx.font = "20px Arial";
    ctx.fillText(`Puntaje: ${puntaje}`, 10, 30);
}

// Reinicia el juego
function reiniciarJuego() {
    pajaro.y = 150;
    pajaro.velocidad = 0;
    tuberias = [];
    puntaje = 0;
    juegoTerminado = false;
}

// Función para hacer saltar al pájaro
function saltar() {
    if (juegoTerminado) {
        reiniciarJuego();
        buclePrincipal();
    } else {
        pajaro.velocidad = pajaro.impulso;
    }
}

// Evento para hacer volar al pájaro con clic
lienzo.addEventListener("click", () => {
    saltar();
});

// Evento para hacer volar al pájaro con la barra espaciadora
document.addEventListener("keydown", (evento) => {
    if (evento.code === "Space") {
        saltar();
    }
});

// Bucle principal del juego
function buclePrincipal() {
    if (juegoTerminado) {
        ctx.fillStyle = "#000";
        ctx.font = "30px Arial";
        ctx.fillText("Game Over", lienzo.width / 2 - 80, lienzo.height / 2);
        ctx.fillText("Haz clic para reiniciar", lienzo.width / 2 - 120, lienzo.height / 2 + 40);
        return;
    }

    ctx.clearRect(0, 0, lienzo.width, lienzo.height);

    dibujarPajaro();
    dibujarTuberias();
    dibujarPuntaje();

    actualizarPajaro();
    actualizarTuberias();
    generarTuberias();

    fotograma++;
    requestAnimationFrame(buclePrincipal);
}

// Inicia el juego
buclePrincipal();