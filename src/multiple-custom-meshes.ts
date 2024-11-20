import mapboxgl, { CustomLayerInterface, Map } from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v10',
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
  private modelMatrix: BABYLON.Matrix | undefined;

  constructor(id: string) {
    this.id = id;
  }

  onAdd = (map: Map, gl: WebGLRenderingContext) => {
    this.map = map;
    const engine = new BABYLON.Engine(gl, true, {
      useHighPrecisionMatrix: true
    }, true);

    this.scene = new BABYLON.Scene(engine);
    this.scene.autoClear = false;
    this.scene.detachControl();
    this.scene.beforeRender = function(){
      engine.wipeCaches(true);
    };
    this.scene.ambientColor = new BABYLON.Color3(1.0, 1.0, 1.0);
    this.camera = new BABYLON.Camera("mapbox-camera", new BABYLON.Vector3(), this.scene);

    const lngLatAlts: Array<[number, number, number]> = [
      [148.9819, -35.39847, 0],
      [148.9859, -35.39847, 300],
      [148.9859, -35.39707, 400]
    ]
    const positions = lngLatAlts.map((p) => {
      const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([p[0], p[1]], p[2]);
      return [mercatorCoord.x, mercatorCoord.y, mercatorCoord.z || 0]
    }).flat();
    const indices = [0, 1, 2];

    const customMesh = new BABYLON.Mesh('custom', this.scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.applyToMesh(customMesh);

    const material = new BABYLON.StandardMaterial('material', this.scene);
    material.ambientColor = new BABYLON.Color3(1, 0, 0);
    material.backFaceCulling = false;
    customMesh.material = material;
  }

  render = (gl: WebGLRenderingContext, matrix: number[]) => {
    // projection & view matrix
    const cameraMatrix = BABYLON.Matrix.FromArray(matrix);
    this.camera!.freezeProjectionMatrix(cameraMatrix);

    this.scene!.render(false);
    this.map!.triggerRepaint();
  }
}

map.on('style.load', () => {
  map.addSource('mapbox-dem', {
    'type': 'raster-dem',
    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
    'tileSize': 512,
    'maxzoom': 14
  });
  // add the DEM source as a terrain layer with exaggerated height
  map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1 });
  const babylonLayer = new BabylonLayer('babylon-layer');
  map.addLayer(babylonLayer);
});