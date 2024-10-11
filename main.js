import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import ndarray from 'ndarray'
import noUiSlider from 'nouislider'

async function load_array(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return new Float64Array(buffer);
}

function get_extreme(arr){
    let maxv = -Number.MAX_VALUE;
    let minv = Number.MAX_VALUE;
    arr.forEach(val => {
        maxv = Math.max(maxv, val)
        minv = Math.min(minv, val)
    })
    return [minv, maxv];
}

function create_label(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 250;
    canvas.height = 250;
    const context = canvas.getContext('2d');
    context.font = 'Bold 100px Arial';
    context.fillStyle = color;
    context.fillText(text, 0, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1, 1, 1);
    return sprite;
}

const container = document.getElementById("three-container")
const camera = new THREE.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 1000 );
camera.position.set(0, 0, 0.7)

let changed = true;
let x_index = 0
let t_index = 0 
let gpd_4d_flat = await load_array("./gpd_4d.bin")
let x = await load_array("./x.bin")
let xi = await load_array("./xi.bin")
let t = await load_array("./t.bin")
let Q2 = await load_array("./Q2.bin")

let dims = [x.length, xi.length, t.length, Q2.length]
let gpd_4d = new ndarray(gpd_4d_flat, dims)
let [min_gpd, max_gpd] = get_extreme(gpd_4d_flat)
let [min_Q2, max_Q2] = get_extreme(Q2)
let [min_xi, max_xi] = get_extreme(xi)

noUiSlider.create(slider_x, {
    start: [0],  
    range: {
        'min': 0,
        'max': x.length - 1
    },
    tooltips: true,  
    step: 1,
    format: {
        to: function (value) {
          return x[Math.round(value)];
        },
        from: function (value) {
          return x.indexOf(value);
        }
    }
});

noUiSlider.create(slider_t, {
    start: [0],  
    range: {
        'min': 0,
        'max': t.length - 1
    },
    tooltips: true,
    step: 1,
    format: {
        to: function (value) {
          return t[Math.round(value)];
        },
        from: function (value) {
          return t.indexOf(value);
        }
    }
});

slider_x.noUiSlider.on('change', function(values, handle) {
    x_index = Math.round(x.indexOf(values[0]));
    changed = true
});

slider_t.noUiSlider.on('change', function(values, handle) {
    t_index = Math.round(t.indexOf(values[0]));
    changed = true;
});


const scene = new THREE.Scene()
const geometry = new THREE.PlaneGeometry(1, 1, xi.length - 1, Q2.length - 1);
const material = new THREE.MeshStandardMaterial({
    vertexColors: true,    
    side: THREE.DoubleSide,
    wireframe: true
});
const plane = new THREE.Mesh(geometry, material)
const global_axis = new THREE.AxesHelper(5); 
const global_grid = new THREE.GridHelper(10, 10);
global_grid.position.set(0, -0.0001, 0)

scene.add(global_grid)
scene.add(global_axis)
scene.add(plane)

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize( container.clientWidth, container.clientHeight );
container.appendChild(renderer.domElement)

window.addEventListener('resize', function() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.innerWidth, container.innerHeight);
});

const controls = new TrackballControls(camera, renderer.domElement);
controls.rotateSpeed = 10.0;
controls.zoomSpeed = 1.2;
controls.panSpeed = 10.0
controls.noPan = false

const axis_scene = new THREE.Scene()
const orient_axis = new THREE.AxesHelper(1);
const axis_camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0, 1000);
axis_scene.add(orient_axis)
axis_camera.position.set(0, 0, 1);
axis_camera.lookAt(0, 0, 0);

const x_label = create_label('xi', '#ff0000');
x_label.position.set(1.2, 0, 0);
axis_scene.add(x_label);

const y_label = create_label('Q2', '#00ff00');
y_label.position.set(0, 1.2, 0);
axis_scene.add(y_label);

const z_label = create_label('GPD', '#0000ff');
z_label.position.set(0, 0, 1.2);
axis_scene.add(z_label);

const positions = geometry.attributes.position;
const colors = new Float32Array(positions.count * 3)

var ambientLight = new THREE.AmbientLight(0xffffff, 2); // soft white light
scene.add(ambientLight);    


function animate() {
    if(changed){
        changed = false
        for (let i = 0; i < positions.count; i++) {
            let Q2_index = Math.floor(i / xi.length)
            let xi_index = i % xi.length
            let gpd_value = (gpd_4d.get(x_index, xi_index, t_index, Q2_index) - min_gpd) / (max_gpd - min_gpd);
            let Q2_value = (Q2[Q2_index] - min_Q2) / (max_Q2 - min_Q2)
            let xi_value = (xi[xi_index] - min_xi) / (max_xi - min_xi)
            positions.setX(i, xi_value);
            positions.setY(i, Q2_value);
            positions.setZ(i, gpd_value);

            let color = evaluate_cmap(gpd_value, 'jet', false)
            colors[i * 3] = color[0] / 255.
            colors[i * 3 + 1] = color[1] / 255.
            colors[i * 3 + 2] = color[2] / 255.
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        positions.needsUpdate = true;
    }

    renderer.setSize( container.clientWidth, container.clientHeight );
    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight)
    controls.update()
    renderer.clear();
	renderer.render( scene, camera );

    renderer.autoClear = false;
    renderer.clearDepth(); 
    renderer.setViewport(10, 10, 150, 150);
    axis_camera.position.copy(camera.position);      // Copy the main camera's position
    axis_camera.quaternion.copy(camera.quaternion);  // Copy the main camera's rotation (quaternion)
    axis_camera.position.normalize();
    renderer.render(axis_scene, axis_camera);
}
renderer.setAnimationLoop( animate );
