const lienzo = document.getElementById("gameCanvas");
const ctx = lienzo.getContext("2d");

// Configuración del juego (valores pensados para 60 fotogramas por segundo)
const CONFIG = {
    ancho: 320,
    alto: 480,
    gravedad: 0.6,
    impulso: -8,
    pajaro: {
        x: 50,
        yInicial: 150,
        ancho: 40,
        alto: 40,
        holgura: 4,       // reduce la caja de choque para que coincida con el dibujo redondo
    },
    tuberia: {
        ancho: 40,
        velocidad: 1.5,   // píxeles por fotograma
        separacion: 180,  // distancia horizontal entre tuberías
        espacio: 120,     // altura de la abertura
        margen: 40,       // distancia mínima de la abertura al techo y al suelo
        bocaAlto: 20,     // altura del borde ancho de la tubería
        bocaExtra: 4,     // cuánto sobresale el borde a cada lado
    },
    suelo: { alto: 60 },
    medallas: [
        { puntos: 30, color: "#ffd700", borde: "#b8860b" }, // oro
        { puntos: 20, color: "#d8d8d8", borde: "#8c8c8c" }, // plata
        { puntos: 10, color: "#d08a4a", borde: "#8a5226" }, // bronce
    ],
    esperaGameOver: 500,  // ms antes de poder reiniciar
    claveRecord: "flappybird-record",
};

const MS_POR_FOTOGRAMA = 1000 / 60;
const SUELO_Y = CONFIG.alto - CONFIG.suelo.alto;

// Lienzo nítido en pantallas de alta densidad
const escalaPixeles = window.devicePixelRatio || 1;
lienzo.width = CONFIG.ancho * escalaPixeles;
lienzo.height = CONFIG.alto * escalaPixeles;
lienzo.style.width = `${CONFIG.ancho}px`;
lienzo.style.height = `${CONFIG.alto}px`;
ctx.setTransform(escalaPixeles, 0, 0, escalaPixeles, 0, 0);

// Estado del juego: "inicio" | "jugando" | "gameOver"
let estado = "inicio";
let pajaro = {
    x: CONFIG.pajaro.x,
    y: CONFIG.pajaro.yInicial,
    ancho: CONFIG.pajaro.ancho,
    alto: CONFIG.pajaro.alto,
    velocidad: 0,
    angulo: 0,
};
let tuberias = []; // cada elemento es un par: { x, aberturaY, pasada }
let puntaje = 0;
let record = cargarRecord();
let nuevoRecord = false;
let momentoGameOver = 0;
let ultimoTiempo = null;
let desplazamiento = 0; // distancia recorrida, para mover el fondo y el suelo

// Nubes del fondo (posiciones fijas que se repiten)
const NUBES = [
    { x: 20, y: 60, escala: 1 },
    { x: 150, y: 110, escala: 0.7 },
    { x: 260, y: 40, escala: 0.9 },
    { x: 380, y: 130, escala: 0.6 },
];

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
    pajaro.angulo = 0;
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

// Aplica la gravedad. Devuelve true si el pájaro tocó el suelo.
function moverPajaro(dt) {
    pajaro.velocidad += CONFIG.gravedad * dt;
    pajaro.y += pajaro.velocidad * dt;

    // Limita el pájaro en la parte superior (sin perder el juego)
    if (pajaro.y < 0) {
        pajaro.y = 0;
        pajaro.velocidad = 0;
    }

    // Inclina el pájaro según suba o baje
    const anguloObjetivo = Math.max(-0.5, Math.min(1.4, pajaro.velocidad * 0.08));
    pajaro.angulo += (anguloObjetivo - pajaro.angulo) * Math.min(1, 0.25 * dt);

    if (pajaro.y + pajaro.alto >= SUELO_Y) {
        pajaro.y = SUELO_Y - pajaro.alto;
        pajaro.velocidad = 0;
        return true;
    }
    return false;
}

function generarTuberias() {
    const ultima = tuberias[tuberias.length - 1];
    if (!ultima || ultima.x <= CONFIG.ancho - CONFIG.tuberia.separacion) {
        const { espacio, margen } = CONFIG.tuberia;
        const aberturaY = margen + Math.random() * (SUELO_Y - espacio - 2 * margen);
        tuberias.push({ x: CONFIG.ancho, aberturaY, pasada: false });
    }
}

function chocaCon(x, y, ancho, alto) {
    const h = CONFIG.pajaro.holgura;
    return (
        pajaro.x + h < x + ancho &&
        pajaro.x + pajaro.ancho - h > x &&
        pajaro.y + h < y + alto &&
        pajaro.y + pajaro.alto - h > y
    );
}

function chocaConTuberia(tuberia) {
    const { ancho, espacio, bocaAlto, bocaExtra } = CONFIG.tuberia;
    const yInferior = tuberia.aberturaY + espacio;
    const bocaX = tuberia.x - bocaExtra;
    const bocaAncho = ancho + 2 * bocaExtra;
    return (
        chocaCon(tuberia.x, 0, ancho, tuberia.aberturaY) ||
        chocaCon(bocaX, tuberia.aberturaY - bocaAlto, bocaAncho, bocaAlto) ||
        chocaCon(tuberia.x, yInferior, ancho, SUELO_Y - yInferior) ||
        chocaCon(bocaX, yInferior, bocaAncho, bocaAlto)
    );
}

function actualizarTuberias(dt) {
    const { ancho, velocidad, bocaExtra } = CONFIG.tuberia;

    for (const tuberia of tuberias) {
        tuberia.x -= velocidad * dt;

        if (chocaConTuberia(tuberia)) {
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
    tuberias = tuberias.filter(t => t.x + ancho + bocaExtra >= 0);
}

function actualizar(dt, tiempo) {
    if (estado !== "gameOver") {
        desplazamiento += CONFIG.tuberia.velocidad * dt;
    }

    if (estado === "inicio") {
        // El pájaro flota esperando que empiece el juego
        pajaro.y = CONFIG.pajaro.yInicial + Math.sin(tiempo / 300) * 8;
        pajaro.angulo = 0;
    } else if (estado === "jugando") {
        if (moverPajaro(dt)) {
            terminarJuego();
            return;
        }
        generarTuberias();
        actualizarTuberias(dt);
    } else {
        // Tras chocar, el pájaro cae hasta el suelo
        moverPajaro(dt);
    }
}

// --- Dibujo: utilidades ---

function rectanguloRedondeado(x, y, ancho, alto, radio) {
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
    ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
    ctx.arcTo(x, y + alto, x, y, radio);
    ctx.arcTo(x, y, x + ancho, y, radio);
    ctx.closePath();
}

function elipse(x, y, radioX, radioY, relleno, borde) {
    ctx.beginPath();
    ctx.ellipse(x, y, radioX, radioY, 0, 0, Math.PI * 2);
    ctx.fillStyle = relleno;
    ctx.fill();
    if (borde) {
        ctx.strokeStyle = borde;
        ctx.stroke();
    }
}

// Texto blanco con contorno oscuro, para leerse sobre el fondo
function escribir(texto, x, y, tamano, alineacion = "center") {
    ctx.font = `bold ${tamano}px Arial`;
    ctx.textAlign = alineacion;
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, tamano / 6);
    ctx.strokeStyle = "#2b2b2b";
    ctx.strokeText(texto, x, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(texto, x, y);
}

// Texto simple, para usar dentro del panel
function rotulo(texto, x, y, tamano, color, negrita = true) {
    ctx.font = `${negrita ? "bold " : ""}${tamano}px Arial`;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
}

// Posición que se repite cada `periodo` píxeles (para el efecto de desplazamiento)
function repetir(valor, periodo) {
    return ((valor % periodo) + periodo) % periodo;
}

// --- Dibujo: escenario ---

function dibujarCielo() {
    const degradado = ctx.createLinearGradient(0, 0, 0, SUELO_Y);
    degradado.addColorStop(0, "#5ec6f5");
    degradado.addColorStop(1, "#c9f1ff");
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, CONFIG.ancho, SUELO_Y);
}

function dibujarNube(x, y, escala) {
    // Una sola figura, para que las partes superpuestas no se vean más claras
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(x + 16 * escala, y);
    ctx.arc(x, y, 16 * escala, 0, Math.PI * 2);
    ctx.moveTo(x + 38 * escala, y - 10 * escala);
    ctx.arc(x + 18 * escala, y - 10 * escala, 20 * escala, 0, Math.PI * 2);
    ctx.moveTo(x + 56 * escala, y);
    ctx.arc(x + 40 * escala, y, 16 * escala, 0, Math.PI * 2);
    ctx.rect(x, y - 2 * escala, 40 * escala, 18 * escala);
    ctx.fill();
}

function dibujarNubes() {
    const periodo = CONFIG.ancho + 120;
    for (const nube of NUBES) {
        const x = repetir(nube.x - desplazamiento * 0.15, periodo) - 60;
        dibujarNube(x, nube.y, nube.escala);
    }
}

function dibujarColinas(base, amplitud, frecuencia, velocidad, color) {
    const desfase = desplazamiento * velocidad;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, SUELO_Y);
    for (let x = 0; x <= CONFIG.ancho; x += 4) {
        const t = (x + desfase) * frecuencia;
        const y = base - (Math.sin(t) * 0.6 + Math.sin(t * 2.3 + 1) * 0.4) * amplitud;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(CONFIG.ancho, SUELO_Y);
    ctx.closePath();
    ctx.fill();
}

function dibujarTubo(x, y, alto, bocaY) {
    const { ancho, bocaAlto, bocaExtra } = CONFIG.tuberia;

    const degradado = ctx.createLinearGradient(x - bocaExtra, 0, x + ancho + bocaExtra, 0);
    degradado.addColorStop(0, "#3d8c1a");
    degradado.addColorStop(0.35, "#9be35a");
    degradado.addColorStop(1, "#3d8c1a");

    ctx.fillStyle = degradado;
    ctx.strokeStyle = "#24520f";
    ctx.lineWidth = 2;

    // Cuerpo
    ctx.fillRect(x, y, ancho, alto);
    ctx.strokeRect(x, y, ancho, alto);

    // Boca (borde ancho junto a la abertura)
    rectanguloRedondeado(x - bocaExtra, bocaY, ancho + 2 * bocaExtra, bocaAlto, 3);
    ctx.fill();
    ctx.stroke();
}

function dibujarTuberias() {
    const { espacio, bocaAlto } = CONFIG.tuberia;
    for (const tuberia of tuberias) {
        const yInferior = tuberia.aberturaY + espacio;
        dibujarTubo(tuberia.x, -2, tuberia.aberturaY + 2, tuberia.aberturaY - bocaAlto);
        dibujarTubo(tuberia.x, yInferior, SUELO_Y - yInferior, yInferior);
    }
}

function dibujarSuelo() {
    const altoPasto = 14;

    // Tierra
    ctx.fillStyle = "#d9a86c";
    ctx.fillRect(0, SUELO_Y, CONFIG.ancho, CONFIG.suelo.alto);
    ctx.fillStyle = "#b07a45";
    ctx.fillRect(0, SUELO_Y + altoPasto, CONFIG.ancho, 3);

    // Pasto con franjas que se desplazan
    ctx.fillStyle = "#6cc24a";
    ctx.fillRect(0, SUELO_Y, CONFIG.ancho, altoPasto);
    ctx.fillStyle = "#58a83a";
    const inicio = -repetir(desplazamiento, 16);
    for (let x = inicio - 16; x < CONFIG.ancho + 16; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, SUELO_Y + altoPasto);
        ctx.lineTo(x + 8, SUELO_Y + altoPasto);
        ctx.lineTo(x + 14, SUELO_Y);
        ctx.lineTo(x + 6, SUELO_Y);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = "#3f7f2a";
    ctx.fillRect(0, SUELO_Y, CONFIG.ancho, 2);
}

// --- Dibujo: pájaro ---

function dibujarPajaro(tiempo) {
    const cx = pajaro.x + pajaro.ancho / 2;
    const cy = pajaro.y + pajaro.alto / 2;
    const aleteo = estado === "gameOver" ? 0 : Math.sin(tiempo / 60) * 4;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(pajaro.angulo);
    ctx.lineWidth = 2;

    // Cuerpo y panza
    elipse(0, 0, 20, 17, "#ff7a45", "#7a2e12");
    elipse(2, 7, 11, 7, "#ffd9b0");

    // Ala
    elipse(-7, 2 + aleteo, 9, 6, "#ffa070", "#7a2e12");

    // Ojo
    elipse(8, -6, 6, 6, "#fff", "#7a2e12");
    elipse(10, -6, 2.5, 2.5, "#222");

    // Pico
    ctx.beginPath();
    ctx.moveTo(15, -1);
    ctx.lineTo(26, 3);
    ctx.lineTo(15, 7);
    ctx.closePath();
    ctx.fillStyle = "#ffc23d";
    ctx.fill();
    ctx.strokeStyle = "#7a2e12";
    ctx.stroke();

    ctx.restore();
}

// --- Dibujo: pantallas ---

function dibujarInicio() {
    const centro = CONFIG.ancho / 2;
    escribir("Flappy Bird", centro, 100, 40);
    escribir("Toca o presiona Espacio", centro, 300, 16);
    escribir("para empezar", centro, 322, 16);
    if (record > 0) {
        escribir(`Récord: ${record}`, centro, 370, 18);
    }
}

function medallaPara(puntos) {
    return CONFIG.medallas.find(m => puntos >= m.puntos) || null;
}

function dibujarGameOver() {
    const centro = CONFIG.ancho / 2;
    const panel = { x: 40, y: 150, ancho: 240, alto: 160 };

    escribir("Game Over", centro, 125, 36);

    // Panel
    ctx.lineWidth = 3;
    rectanguloRedondeado(panel.x, panel.y, panel.ancho, panel.alto, 10);
    ctx.fillStyle = "#fff3d6";
    ctx.fill();
    ctx.strokeStyle = "#8a5a2b";
    ctx.stroke();

    // Medalla
    const medallaX = panel.x + 65;
    const medallaY = panel.y + 90;
    const medalla = medallaPara(puntaje);
    rotulo("Medalla", medallaX, panel.y + 35, 14, "#8a5a2b");
    ctx.lineWidth = 3;
    elipse(medallaX, medallaY, 28, 28, medalla ? medalla.color : "#ecdcb8", medalla ? medalla.borde : "#c9b48a");
    if (medalla) {
        elipse(medallaX, medallaY, 18, 18, "rgba(255, 255, 255, 0.35)");
    }

    // Puntaje y récord
    const columnaX = panel.x + 175;
    rotulo("Puntaje", columnaX, panel.y + 35, 14, "#8a5a2b");
    rotulo(String(puntaje), columnaX, panel.y + 64, 26, "#3a2a1a");
    rotulo("Récord", columnaX, panel.y + 98, 14, "#8a5a2b");
    rotulo(String(record), columnaX, panel.y + 127, 26, "#3a2a1a");
    if (nuevoRecord) {
        rotulo("¡Nuevo récord!", columnaX, panel.y + 148, 12, "#d23c2a");
    }

    if (performance.now() - momentoGameOver >= CONFIG.esperaGameOver) {
        escribir("Toca o presiona Espacio", centro, 350, 16);
        escribir("para reiniciar", centro, 372, 16);
    }
}

function dibujarDestello() {
    const transcurrido = performance.now() - momentoGameOver;
    if (transcurrido < 150) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * (1 - transcurrido / 150)})`;
        ctx.fillRect(0, 0, CONFIG.ancho, CONFIG.alto);
    }
}

function dibujar(tiempo) {
    dibujarCielo();
    dibujarNubes();
    dibujarColinas(SUELO_Y - 70, 25, 0.015, 0.3, "#a8dca5");
    dibujarColinas(SUELO_Y - 25, 18, 0.025, 0.6, "#74c27a");
    dibujarTuberias();
    dibujarSuelo();
    dibujarPajaro(tiempo);

    if (estado === "inicio") {
        dibujarInicio();
    } else if (estado === "jugando") {
        escribir(String(puntaje), CONFIG.ancho / 2, 70, 40);
    } else {
        dibujarGameOver();
        dibujarDestello();
    }
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
    dibujar(tiempo);
    requestAnimationFrame(buclePrincipal);
}

requestAnimationFrame(buclePrincipal);
