import mapboxgl, { CustomLayerInterface, Map } from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders/glTF';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const center = [148.9819, -35.3981] as [number, number];
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    zoom: 15,
    center,
    pitch: 60,
    antialias: true // create the gl context with MSAA antialiasing, so custom layers are antialiased
});

class BabylonLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private map: Map | undefined;
  private scene: BABYLON.Scene | undefined;
  private camera: BABYLON.Camera | undefined;

  constructor(id: string) {
    this.id = id;
  }

  onAdd = (map: Map, gl: WebGL2RenderingContext) => {
    this.map = map;
    const engine = new BABYLON.Engine(gl, true, {
      useHighPrecisionMatrix: true,
    }, true);

    this.scene = new BABYLON.Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false
    this.scene.detachControl();
    this.scene.beforeRender = function(){
      engine.wipeCaches(true);
    };
    this.camera = new BABYLON.Camera("mapbox-camera", new BABYLON.Vector3(), this.scene);
    const light = new BABYLON.HemisphericLight("mapbox-light", new BABYLON.Vector3(0.5, 0.5, 4000), this.scene);
    const world = new BABYLON.TransformNode("world", this.scene);
    const centerCoord = mapboxgl.MercatorCoordinate.fromLngLat(center, 1000)
    const scaleFactor = centerCoord.meterInMercatorCoordinateUnits();
    world.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
    world.position = new BABYLON.Vector3(centerCoord.x, centerCoord.y, centerCoord.z);
    const boxCoord = mapboxgl.MercatorCoordinate.fromLngLat([148.9859, -35.39847], 1200);
    console.log(boxCoord)
    console.log(centerCoord)
    const x = (boxCoord.x - centerCoord.x) / scaleFactor;
    const y = (boxCoord.y - centerCoord.y) / scaleFactor;
    const z = (boxCoord.z - centerCoord.z) / scaleFactor;
    console.log(x,y, z)
    // const boxMesh = BABYLON.MeshBuilder.CreateBox('box', {
    //   size: 200
    // }, this.scene);
    // boxMesh.position = new BABYLON.Vector3(x, y, z);
    // boxMesh.parent = world;
    const axes = new BABYLON.Debug.AxesViewer(this.scene, 500, 1)
    axes.xAxis.parent = world;
    axes.yAxis.parent = world;
    axes.zAxis.parent = world;

    BABYLON.SceneLoader.AppendAsync("https://docs.mapbox.com/mapbox-gl-js/assets/34M_17/", "34M_17.gltf", this.scene).then(scene => {
      const mesh = scene.rootNodes[3] as BABYLON.Mesh;
      mesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
      mesh.position = new BABYLON.Vector3(x, y, z);
      mesh.scaling.setAll(10)
      mesh.parent = world;
      console.log(mesh)
      const children = mesh.getChildMeshes();
      children.forEach(child => {
        if (child.material) {
          // child.material.zOffset = 1 / scaleFactor
          // child.material.useLogarithmicDepth = true;
        }
      })
    });

    // const sphereCoord = mapboxgl.MercatorCoordinate.fromLngLat([148.9859, -35.39847], 1200);
    // const sphereMesh = BABYLON.MeshBuilder.CreateSphere('sphere', {
    //   diameter: 300 * sphereCoord.meterInMercatorCoordinateUnits()
    // }, this.scene);
    // sphereMesh.position = new BABYLON.Vector3(sphereCoord.x, sphereCoord.y, sphereCoord.z);
  }

  render = (gl: WebGL2RenderingContext, matrix: number[]) => {
    // projection & view matrix
    const cameraMatrix = BABYLON.Matrix.FromArray(matrix);
    this.camera!.freezeProjectionMatrix(cameraMatrix);
    this.scene!.render(false);
    this.map!.triggerRepaint();
  }
}

map.on('style.load', async () => {
  const babylonLayer = new BabylonLayer('babylon-layer');
  map.addLayer(babylonLayer);
  map.addSource('mapbox-dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.terrain-rgb',
    tileSize: 512,
    maxzoom: 14,
  });
  // add the DEM source as a terrain layer with exaggerated height
  map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
  await map.once('idle')
  const elevation = map.queryTerrainElevation(center, {exaggerated: true})
  console.log(elevation)
});