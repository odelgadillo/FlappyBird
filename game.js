const lienzo = document.getElementById("gameCanvas");
const ctx = lienzo.getContext("2d");

// Configuración del juego (valores pensados para 60 fotogramas por segundo)
const CONFIG = {
    ancho: 320,
    alto: 480,
    gravedad: 0.6,
    impulso: -8,
    pajaro: { x: 50, yInicial: 150, ancho: 40, alto: 40 },
    tuberia: {
        ancho: 40,
        velocidad: 1.5,   // píxeles por fotograma
        separacion: 180,  // distancia horizontal entre tuberías
        espacio: 120,     // altura de la abertura
        margen: 40,       // distancia mínima de la abertura al techo y al suelo
    },
    esperaGameOver: 500,  // ms antes de poder reiniciar
    claveRecord: "flappybird-record",
};

const MS_POR_FOTOGRAMA = 1000 / 60;

lienzo.width = CONFIG.ancho;
lienzo.height = CONFIG.alto;

// Estado del juego: "inicio" | "jugando" | "gameOver"
let estado = "inicio";
let pajaro = { x: CONFIG.pajaro.x, y: CONFIG.pajaro.yInicial, ancho: CONFIG.pajaro.ancho, alto: CONFIG.pajaro.alto, velocidad: 0 };
let tuberias = []; // cada elemento es un par: { x, aberturaY, pasada }
let puntaje = 0;
let record = cargarRecord();
let nuevoRecord = false;
let momentoGameOver = 0;
let ultimoTiempo = null;

// --- Récord ---

function cargarRecord() {
    try {
        return parseInt(localStorage.getItem(CONFIG.claveRecord), 10) || 0;
    } catch {
        return 0;
    }
}

function guardarRecord() {
    try {
        localStorage.setItem(CONFIG.claveRecord, String(record));
    } catch {
        // Sin acceso a localStorage: el récord solo dura esta sesión
    }
}

// --- Lógica ---

function reiniciarJuego() {
    pajaro.y = CONFIG.pajaro.yInicial;
    pajaro.velocidad = 0;
    tuberias = [];
    puntaje = 0;
    nuevoRecord = false;
    estado = "inicio";
}

function terminarJuego() {
    estado = "gameOver";
    momentoGameOver = performance.now();
    if (puntaje > record) {
        record = puntaje;
        nuevoRecord = true;
        guardarRecord();
    }
}

function actualizarPajaro(dt) {
    pajaro.velocidad += CONFIG.gravedad * dt;
    pajaro.y += pajaro.velocidad * dt;

    // Limita el pájaro en la parte superior (sin perder el juego)
    if (pajaro.y < 0) {
        pajaro.y = 0;
        pajaro.velocidad = 0;
    }

    // Tocar el suelo termina el juego
    if (pajaro.y + pajaro.alto >= CONFIG.alto) {
        pajaro.y = CONFIG.alto - pajaro.alto;
        terminarJuego();
    }
}

function generarTuberias() {
    const ultima = tuberias[tuberias.length - 1];
    if (!ultima || ultima.x <= CONFIG.ancho - CONFIG.tuberia.separacion) {
        const { espacio, margen } = CONFIG.tuberia;
        const aberturaY = margen + Math.random() * (CONFIG.alto - espacio - 2 * margen);
        tuberias.push({ x: CONFIG.ancho, aberturaY, pasada: false });
    }
}

function chocaCon(x, y, ancho, alto) {
    return (
        pajaro.x < x + ancho &&
        pajaro.x + pajaro.ancho > x &&
        pajaro.y < y + alto &&
        pajaro.y + pajaro.alto > y
    );
}

function actualizarTuberias(dt) {
    const { ancho, velocidad, espacio } = CONFIG.tuberia;

    for (const tuberia of tuberias) {
        tuberia.x -= velocidad * dt;

        const yInferior = tuberia.aberturaY + espacio;
        if (
            chocaCon(tuberia.x, 0, ancho, tuberia.aberturaY) ||
            chocaCon(tuberia.x, yInferior, ancho, CONFIG.alto - yInferior)
        ) {
            terminarJuego();
            return;
        }

        // Un punto por cada par de tuberías, al pasarlo
        if (!tuberia.pasada && tuberia.x + ancho < pajaro.x) {
            tuberia.pasada = true;
            puntaje++;
        }
    }

    // Elimina las tuberías que salieron de la pantalla
    tuberias = tuberias.filter(t => t.x + ancho >= 0);
}

function actualizar(dt, tiempo) {
    if (estado === "inicio") {
        // El pájaro flota esperando que empiece el juego
        pajaro.y = CONFIG.pajaro.yInicial + Math.sin(tiempo / 300) * 8;
    } else if (estado === "jugando") {
        actualizarPajaro(dt);
        if (estado === "jugando") {
            generarTuberias();
            actualizarTuberias(dt);
        }
    }
}

// --- Dibujo ---

function dibujarPajaro() {
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(pajaro.x, pajaro.y, pajaro.ancho, pajaro.alto);
}

function dibujarTuberias() {
    const { ancho, espacio } = CONFIG.tuberia;
    ctx.fillStyle = "#008000";
    for (const tuberia of tuberias) {
        const yInferior = tuberia.aberturaY + espacio;
        ctx.fillRect(tuberia.x, 0, ancho, tuberia.aberturaY);
        ctx.fillRect(tuberia.x, yInferior, ancho, CONFIG.alto - yInferior);
    }
}

function escribir(texto, x, y, tamano, alineacion = "center") {
    ctx.font = `bold ${tamano}px Arial`;
    ctx.textAlign = alineacion;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fff";
    ctx.strokeText(texto, x, y);
    ctx.fillStyle = "#000";
    ctx.fillText(texto, x, y);
}

function dibujarMarcador() {
    escribir(`Puntaje: ${puntaje}`, 10, 30, 18, "left");
    escribir(`Récord: ${record}`, CONFIG.ancho - 10, 30, 18, "right");
}

function dibujarInicio() {
    const centro = CONFIG.ancho / 2;
    escribir("Flappy Bird", centro, CONFIG.alto / 2 - 40, 36);
    escribir("Toca o presiona Espacio", centro, CONFIG.alto / 2 + 60, 16);
    escribir("para empezar", centro, CONFIG.alto / 2 + 82, 16);
}

function dibujarGameOver() {
    const centro = CONFIG.ancho / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, CONFIG.ancho, CONFIG.alto);

    escribir("Game Over", centro, CONFIG.alto / 2 - 60, 36);
    escribir(`Puntaje: ${puntaje}`, centro, CONFIG.alto / 2 - 15, 20);
    escribir(`Récord: ${record}`, centro, CONFIG.alto / 2 + 15, 20);
    if (nuevoRecord) {
        escribir("¡Nuevo récord!", centro, CONFIG.alto / 2 + 45, 18);
    }
    if (performance.now() - momentoGameOver >= CONFIG.esperaGameOver) {
        escribir("Toca o presiona Espacio", centro, CONFIG.alto / 2 + 90, 16);
        escribir("para reiniciar", centro, CONFIG.alto / 2 + 112, 16);
    }
}

function dibujar() {
    ctx.clearRect(0, 0, CONFIG.ancho, CONFIG.alto);
    dibujarTuberias();
    dibujarPajaro();
    dibujarMarcador();

    if (estado === "inicio") dibujarInicio();
    if (estado === "gameOver") dibujarGameOver();
}

// --- Controles ---

function accion() {
    if (estado === "inicio") {
        estado = "jugando";
        pajaro.velocidad = CONFIG.impulso;
    } else if (estado === "jugando") {
        pajaro.velocidad = CONFIG.impulso;
    } else if (performance.now() - momentoGameOver >= CONFIG.esperaGameOver) {
        reiniciarJuego();
    }
}

// Clic de ratón y toque en pantallas táctiles
lienzo.addEventListener("pointerdown", evento => {
    evento.preventDefault();
    accion();
});

document.addEventListener("keydown", evento => {
    if (evento.code === "Space") {
        evento.preventDefault();
        if (!evento.repeat) accion();
    }
});

// --- Bucle principal ---

function buclePrincipal(tiempo) {
    if (ultimoTiempo === null) ultimoTiempo = tiempo;
    // dt = 1 equivale a un fotograma a 60 FPS; se limita para evitar saltos al volver a la pestaña
    const dt = Math.min((tiempo - ultimoTiempo) / MS_POR_FOTOGRAMA, 3);
    ultimoTiempo = tiempo;

    actualizar(dt, tiempo);
    dibujar();
    requestAnimationFrame(buclePrincipal);
}

requestAnimationFrame(buclePrincipal);
