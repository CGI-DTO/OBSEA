import * as THREE from 'three';
import { OrbitControls } from 'https://threejs.org/examples/jsm/controls/OrbitControls.js';
//import { OBJLoader } from 'https://threejs.org/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'https://threejs.org/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://threejs.org/examples/jsm/loaders/FBXLoader.js'
// import { GUI } from 'https://threejs.org/examples/jsm/libs/lil-gui.module.min.js';


/* OCEAN
https://threejs.org/examples/webgl_shaders_ocean.html
https://29a.ch/slides/2012/webglwater/
https://29a.ch/sandbox/2012/terrain/
https://www.tamats.com/work/bwr/
https://madebyevan.com/webgl-water/
https://www.youtube.com/watch?v=kGEqaX4Y4bQ&ab_channel=JumpTrajectory
https://doc.babylonjs.com/advanced_topics/webGPU/computeShader
https://playground.babylonjs.com/?webgpu#YX6IB8#55
http://david.li/waves/
https://www.shadertoy.com/view/4dBcRD#
https://www.shadertoy.com/view/Xdlczl


TODO:
- Create a multiresolution plane
  - Future: Resolution based on camera position?
- Shader development platform for testing
- Implement ocean shader

- Fix fog above/below surface
- Skybox
  - Future: linked to real sun position


*/


function main() {
  // Cache
  THREE.Cache.enabled = false;

  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.outputEncoding = THREE.sRGBEncoding;

  const fov = 45;
  const aspect = 2;  // the canvas default
  const near = 0.1;
  const far = 1000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  

  const controls = new OrbitControls(camera, canvas);
  // TODO: limit orbit controls
  // Surface
  camera.position.set(5, 3, 5);
  controls.target.set(0, 1, 0);
  // OBSEA base
  // camera.position.set(3, -16, 3);
  // controls.target.set(0,-19, 0);

  
  controls.update();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x47A0B9);
  
  
  // Fog
  scene.fog = new THREE.FogExp2(new THREE.Color(0x47A0B9), 0.02);

  THREE.ShaderChunk.fog_fragment = `
    #ifdef USE_FOG
      vec3 fogOrigin = cameraPosition;
      vec3 fogDirection = normalize(vWorldPosition - fogOrigin);
      float fogDepth = distance(vWorldPosition, fogOrigin);

      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
      #else
        float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
      #endif

      float heightFactor = max( -vWorldPosition.y / abs(vWorldPosition.y), 0.0);
      fogFactor = min(1.0, fogFactor * heightFactor);

      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    #endif
  `;

  THREE.ShaderChunk.fog_pars_fragment = `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying vec3 vWorldPosition;
      #ifdef FOG_EXP2
        uniform float fogDensity;
      #else
        uniform float fogNear;
        uniform float fogFar;
      #endif
    #endif
  `;

  THREE.ShaderChunk.fog_vertex = `
    #ifdef USE_FOG
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      // vWorldPosition = position.xyz;
    #endif
  `;

  THREE.ShaderChunk.fog_pars_vertex = `
    #ifdef USE_FOG
      varying vec3 vWorldPosition;
    #endif
  `;



  { // TOP PLANE (ROSA DELS VENTS)
    const planeSize = 5;

    const loader = new THREE.TextureLoader();
    // const texture = loader.load('https://threejs.org/manual/examples/resources/images/checker.png');
    const texture = loader.load('../3Dcurrent/NESW.png');
    texture.encoding = THREE.sRGBEncoding;
    //texture.wrapS = THREE.RepeatWrapping;
    //texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter; //THREE.NearestFilter;
    //const repeats = planeSize / 10;
    //texture.repeat.set(repeats, repeats);

    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMat = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.rotation.x = Math.PI * -.5;
    scene.add(mesh);
  }

  // BOTTOM PLANE (SAND)
  {
    const pBottomSize = 200;
    const loader = new THREE.TextureLoader();
    const bottTexture = loader.load('../Assets/Terrain/SandDiffuse.jpg');
    bottTexture.wrapS = THREE.RepeatWrapping;
    bottTexture.wrapT = THREE.RepeatWrapping;
    bottTexture.magFilter = THREE.LinearFilter; //THREE.NearestFilter;
    const repeats = pBottomSize / 10;
    bottTexture.repeat.set(repeats, repeats);
    
    const planeBottom = new THREE.PlaneGeometry(pBottomSize, pBottomSize);
    const pBottMat = new THREE.MeshPhongMaterial({
      map: bottTexture,
      side: THREE.DoubleSide,
      transparent: true
    });
    const pBottMesh = new THREE.Mesh(planeBottom, pBottMat);
    pBottMesh.translateY(-19.4);
    pBottMesh.rotation.x = Math.PI * -.5;
    
    scene.add(pBottMesh);

  }


  


  { // LIGHT
    const skyColor = 0xB1E1FF;  // light blue
    const groundColor = 0x2090b9;  // blue
    const intensity = 0.6;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  { // LIGHT
    const color = 0xFFFFFF;
    const intensity = 0.8;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 10, 0);
    light.target.position.set(-5, 0, 0);
    scene.add(light);
    scene.add(light.target);
  }

  
  
  
  { // OBSEA Station
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../Assets/OBSEAStation/OBSEAStation.glb', (gltf) => {
      // GLTF scene
      const root = gltf.scene;
      // Fix frustrum culling
      root.children[0].children[1].frustumCulled = false;
      // Scene direction fix
      const angleFix = 90;
      
      root.rotation.y = angleFix * Math.PI / 180;
      root.translateY(-19.4);
      
      scene.add(root);
      console.log(dumpObject(root).join('\n'));
    });


  }


  { // OBSEA Buoy
    // https://www.youtube.com/watch?v=6LA8vEB47Nk&ab_channel=DirkTeucher
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../Assets/OBSEABuoy/OBSEABuoy.glb', (gltf) => {
      // GLTF scene
      const root = gltf.scene;
      // Fix frustrum culling
      root.children[0].children[1].frustumCulled = false;
      // Scene direction fix
      const angleFix = 90;

      root.rotation.y = angleFix * Math.PI / 180;
      scene.add(root);

      // Material AO
      let mesh = root.children[0];
      let material = mesh.material;
      //material.aoMapIntensity = 2      

      console.log(dumpObject(root).join('\n'));
    });


  }



  // Print scene outline
  function dumpObject(obj, lines = [], isLast = true, prefix = '') {
    const localPrefix = isLast ? '└─' : '├─';
    lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    const lastNdx = obj.children.length - 1;
    obj.children.forEach((child, ndx) => {
      const isLast = ndx === lastNdx;
      dumpObject(child, lines, isLast, newPrefix);
    });
    return lines;
  }




  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render() {

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
