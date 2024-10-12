import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import ndarray from 'ndarray'
import noUiSlider from 'nouislider'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';


async function load_array(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return new Float64Array(buffer);
}

function get_center(mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh); // Compute bounding box
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);  // Get the center of the bounding box
    return center;
  }

function create_label(text, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 400
    canvas.height = 400
    context.font = 'Bold 100px Arial';
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2 - 50, canvas.height / 2 + 50);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    return sprite;
}

function create_line(start, end, width, color){
    const geometry = new LineSegmentsGeometry().setPositions([start.x, start.y, start.z, end.x, end.y, end.z])
    const material = new LineMaterial({
        color: color,   
        linewidth: 5
    });
    return new LineSegments2(geometry, material);
}

function create_axis(center, width=8.0, scale=0.5, labelx="x", labely="y", labelz="z") {
    let x_axis = create_line(center, new THREE.Vector3(center.x + scale, center.y, center.z), width, '#ff0000')
    let y_axis = create_line(center, new THREE.Vector3(center.x, center.y + scale, center.z), width, '#00ff00')
    let z_axis = create_line(center, new THREE.Vector3(center.x, center.y, center.z + scale), width, '#0000ff')
    let x_label = create_label(labelx, '#ff0000')
    let y_label = create_label(labely, '#00ff00')
    let z_label = create_label(labelz, '#0000ff')
    x_label.position.set(center.x + scale + 0.5, center.y, center.z);
    y_label.position.set(center.x, center.y + scale + 0.5, center.z);
    z_label.position.set(center.x, center.y, center.z + scale + 0.5);
    return [x_axis, y_axis, z_axis, x_label, y_label, z_label];
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
const global_axis = create_axis(new THREE.Vector3(0, 0, 0), 1.0, 2.0, "Xi", "Q2", "GPD")
const global_gridzx = new THREE.GridHelper(4, 4);
const global_gridxy = new THREE.GridHelper(4, 4);
global_gridxy.rotation.x = Math.PI / 2;
const global_gridyz = new THREE.GridHelper(4, 4);
global_gridyz.rotation.z = Math.PI / 2;

scene.add(global_gridxy)
scene.add(global_gridyz)
scene.add(global_gridzx)
global_axis.forEach(element => {
    scene.add(element)
});
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
const mesh_center = get_center(plane);
controls.target.set(mesh_center.x, mesh_center.y, mesh_center.z)

const axis_scene = new THREE.Scene()
const orient_axis = create_axis(new THREE.Vector3(0, 0, 0), 8.0, 0.5, "Xi", "Q2", "GPD")
const axis_camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.0, 1000);
orient_axis.forEach(element => {
    axis_scene.add(element);
});

const positions = geometry.attributes.position;
const colors = new Float32Array(positions.count * 3)

var ambientLight = new THREE.AmbientLight(0xffffff, 2); // soft white light
scene.add(ambientLight);  

for (let i = 0; i < positions.count; i++) {
    let Q2_index = Math.floor(i / xi.length)
    let xi_index = i % xi.length
    let Q2_value = (Q2[Q2_index] - min_Q2) / (max_Q2 - min_Q2)
    let xi_value = (xi[xi_index] - min_xi) / (max_xi - min_xi)
    positions.setX(i, xi_value);
    positions.setY(i, Q2_value);
}

function animate() {
    if(changed){
        changed = false
        for (let i = 0; i < positions.count; i++) {
            let Q2_index = Math.floor(i / xi.length)
            let xi_index = i % xi.length
            let gpd_value = (gpd_4d.get(x_index, xi_index, t_index, Q2_index) - min_gpd) / (max_gpd - min_gpd);
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
    renderer.setViewport(0, 0, 300, 300);
    axis_camera.position.copy(camera.position);      // Copy the main camera's position
    axis_camera.quaternion.copy(camera.quaternion);  // Copy the main camera's rotation (quaternion)
    axis_camera.position.normalize();
    renderer.render(axis_scene, axis_camera);
}
renderer.setAnimationLoop( animate );


window.controls = controls
window.camera = camera
