import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

// Setup base
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
// Sfondo trasparente per far vedere l'immagine CSS
scene.background = null;

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 8);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Controlli orbitali (solo rotazione, disabilita zoom/pan se preferisci)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 12;

// Luci per effetto Glossy / Inflatable
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight2.position.set(-5, 5, -5);
scene.add(dirLight2);

// Materiale principale del palloncino (Rosa pastello, lucido, clay/inflatable)
const balloonMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xF467B9, // pastello-pink
    roughness: 0.15,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88          // leggermente trasparente: gli sticker sul retro appaiono
                           // come forme latenti attraverso il rosa — effetto estetico voluto
});

// Gruppo che conterrà corpo e nodo
const balloonGroup = new THREE.Group();
scene.add(balloonGroup);

// Corpo ovoidale
const bodyGeo = new THREE.SphereGeometry(2, 64, 64);
const balloonBody = new THREE.Mesh(bodyGeo, balloonMaterial);
balloonBody.scale.set(1, 1.2, 1); // Rende la sfera ovoidale
balloonGroup.add(balloonBody);

// Nodino alla base
const knotGeo = new THREE.CylinderGeometry(0.1, 0.3, 0.4, 32);
const knotMesh = new THREE.Mesh(knotGeo, balloonMaterial);
knotMesh.position.y = -2.3;
balloonGroup.add(knotMesh);

// Pagine e textures
const pages = [
    { id: 'abstract', img: 'images/abstract.png', url: 'abstract.html' },
    { id: 'casi-studio', img: 'images/casi_studio.png', url: 'casi-studio.html' },
    { id: 'dashboard', img: 'images/dashboard.png', url: 'dashboard.html' },
    { id: 'design', img: 'images/design.png', url: 'design.html' },
    { id: 'moodboard', img: 'images/moodboard.png', url: 'moodboard.html' },
    { id: 'musica', img: 'images/musica.png', url: 'musica.html' },
    { id: 'video', img: 'images/video.png', url: 'video.html' }
];

const textureLoader = new THREE.TextureLoader();
const clickables = []; // Qui salviamo le mesh cliccabili

// Distribuiamo i 7 sticker equamente. Usiamo coordinate sferiche (Fibonacci sphere)
const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
let loadedCount = 0;

pages.forEach((page, i) => {
    textureLoader.load(page.img, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        
        // Calcolo posizione distribuita usando sfera di Fibonacci
        // Limitiamo la Y per evitare i poli (cima e fondo)
        const yRange = 0.65;
        const y = yRange - (i / (pages.length - 1)) * (yRange * 2); 
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;

        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        // Moltiplichiamo per il raggio del nostro palloncino (circa 2)
        // L'ovale è scalato su Y, quindi compensiamo
        const position = new THREE.Vector3(x * 2.1, y * 2.1 * 1.2, z * 2.1);
        
        // Orientamento: l'adesivo deve guardare verso l'esterno lungo la normale dell'ellissoide
        const orientation = new THREE.Euler();
        const dummyObj = new THREE.Object3D();
        dummyObj.position.copy(position);
        
        // Calcoliamo la normale corretta per un ellissoide (scalato su Y di 1.2)
        const normal = position.clone();
        normal.y /= (1.2 * 1.2);
        normal.normalize();
        
        // Guarda verso l'esterno per evitare immagini specchiate
        dummyObj.lookAt(position.clone().add(normal)); 
        orientation.copy(dummyObj.rotation);
        
        // Rotazione fissa pseudocasuale per ogni sticker (non cambia ricaricando)
        const pseudoRandomRotation = (i * 137.5) * (Math.PI / 180);
        orientation.z = pseudoRandomRotation;

        // Dimensione del decal (molto più grande come richiesto)
        const size = new THREE.Vector3(2.5, 2.5, 2.5); 

        const decalGeo = new DecalGeometry(balloonBody, position, orientation, size);
        
        const decalMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,  // disabilitato: elimina completamente il z-fighting
                               // gli sticker sono sempre visibili, senza "macchie"
            depthWrite: false
        });

        const decalMesh = new THREE.Mesh(decalGeo, decalMat);
        decalMesh.renderOrder = 1;  // renderizzato DOPO il palloncino (renderOrder 0)
                                    // garantisce che il rosa semi-trasparente "veli"
                                    // correttamente gli sticker del retro
        decalMesh.userData = { url: page.url };
        balloonGroup.add(decalMesh);
        clickables.push(decalMesh);

        loadedCount++;
        if (loadedCount === pages.length) {
            document.getElementById('loading').style.opacity = '0';
        }
    });
});

// Sistema di Interazione (Raycaster con Drag Detection)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isPopping = false;
let startX = 0;
let startY = 0;

window.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    startY = event.clientY;
});

window.addEventListener('pointerup', (event) => {
    if (isPopping) return;

    // Calcoliamo quanto si è mosso il mouse
    const diffX = Math.abs(event.clientX - startX);
    const diffY = Math.abs(event.clientY - startY);
    
    // Se ha trascinato il cursore (più di 5 pixel), non è un click, è un'orbitazione!
    if (diffX > 5 || diffY > 5) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Controlla intersezioni solo con gli sticker
    const intersects = raycaster.intersectObjects(clickables);

    if (intersects.length > 0) {
        const url = intersects[0].object.userData.url;
        triggerPopAnimation(url);
    }
});

// cursore a forma di puntatore
window.addEventListener('pointermove', (event) => {
    if (isPopping) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickables);
    if(intersects.length > 0){
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
});


// Animazione e Suono
function playPopSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
}

function triggerPopAnimation(url) {
    isPopping = true;
    document.body.style.cursor = 'default';
    playPopSound();

    let scale = 1;
    const interval = setInterval(() => {
        scale += 0.1; // Si gonfia velocemente
        balloonGroup.scale.set(scale, scale, scale);
        
        if (scale > 1.3) {
            clearInterval(interval);
            balloonGroup.visible = false; // "Scoppia" e scompare
            
            // Attende un attimo e poi cambia pagina
            setTimeout(() => {
                window.location.href = url;
            }, 300);
        }
    }, 20);
}

// Resize della finestra
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Loop di animazione
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Leggero galleggiamento per dare un senso "inflatable"
    if (!isPopping) {
        balloonGroup.position.y = Math.sin(Date.now() * 0.002) * 0.1;
    }

    renderer.render(scene, camera);
}
animate();
