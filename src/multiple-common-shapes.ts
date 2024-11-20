import mapboxgl, { CustomLayerInterface, Map } from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    zoom: 15,
    center: [148.9819, -35.3981],
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

    const boxCoord = mapboxgl.MercatorCoordinate.fromLngLat([148.9819, -35.39847], 989);
    const size = 200 * boxCoord.meterInMercatorCoordinateUnits();
    const boxMesh = BABYLON.MeshBuilder.CreateBox('box', {
      size
    }, this.scene);
    boxMesh.position = new BABYLON.Vector3(boxCoord.x, boxCoord.y, boxCoord.z);
    boxMesh.translate(BABYLON.Axis.Z, size / 2, BABYLON.Space.WORLD);

    const sphereCoord = mapboxgl.MercatorCoordinate.fromLngLat([148.9859, -35.39847], 1200);
    const sphereMesh = BABYLON.MeshBuilder.CreateSphere('sphere', {
      diameter: 300 * sphereCoord.meterInMercatorCoordinateUnits()
    }, this.scene);
    sphereMesh.position = new BABYLON.Vector3(sphereCoord.x, sphereCoord.y, sphereCoord.z);
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
  const elevation = map.queryTerrainElevation([148.9819, -35.39847], {exaggerated: true})
  console.log(elevation)
});