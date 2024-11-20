import mapboxgl, {CustomLayerInterface, LngLatLike, Map} from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders/glTF';
import 'mapbox-gl/dist/mapbox-gl.css';

// parameters to ensure the model is georeferenced correctly on the map
// const modelOrigin = [148.9819, -35.39847] as LngLatLike;
const modelOrigin = [-114.26608, 32.7213] as LngLatLike;
const modelAltitude = 141;
const modelRotate = [Math.PI / 2, 0, 0];
const modelCoords = mapboxgl.MercatorCoordinate.fromLngLat(
  modelOrigin,
  modelAltitude
);
const modelScale = modelCoords.meterInMercatorCoordinateUnits();

mapboxgl.accessToken =
  'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  zoom: 18,
  center: modelOrigin,
  pitch: 60,
  antialias: true, // create the gl context with MSAA antialiasing, so custom layers are antialiased
});

class BabylonLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private map: Map | undefined;
  private scene: BABYLON.Scene | undefined;
  private engine: BABYLON.Engine | undefined;
  private camera: BABYLON.Camera | undefined;
  private modelMatrix: BABYLON.Matrix | undefined;

  constructor(id: string) {
    this.id = id;
  }

  onAdd = (map: Map, gl: WebGLRenderingContext) => {
    this.map = map;
    const engine = new BABYLON.Engine(
      gl,
      true,
      {
        useHighPrecisionMatrix: true,
      },
      true
    );
    this.engine = engine;

    this.scene = new BABYLON.Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false
    this.scene.detachControl();
    this.scene.registerAfterRender(() => {
      engine.wipeCaches(true);
    })

    this.camera = new BABYLON.Camera(
      'mapbox-camera',
      new BABYLON.Vector3(),
      this.scene
    );
    const light = new BABYLON.HemisphericLight(
      'mapbox-light',
      BABYLON.Vector3.One(),
      this.scene
    );

    const boxMesh = BABYLON.MeshBuilder.CreateBox('box', {
      size: 200,
    }, this.scene)
    boxMesh.position = new BABYLON.Vector3(0, 0, 0)

    this.modelMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(modelScale, modelScale, modelScale),
      BABYLON.Quaternion.FromEulerAngles(
        modelRotate[0],
        modelRotate[1],
        modelRotate[2]
      ),
      new BABYLON.Vector3(modelCoords.x, modelCoords.y, modelCoords.z)
    );
  };

  render = (gl: WebGLRenderingContext, matrix: number[]) => {
    // projection & view matrix
    const cameraMatrix = BABYLON.Matrix.FromArray(matrix);
    const mvpMatrix = this.modelMatrix!.multiply(cameraMatrix);
    this.camera!.freezeProjectionMatrix(mvpMatrix);
    this.scene!.render(false);
    this.map!.triggerRepaint();
  };
}

map.on('style.load', async () => {
  const babylonLayer = new BabylonLayer('babylon-layer');
  map.addLayer(babylonLayer);
  map.addSource('mapbox-dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSize: 512,
    maxzoom: 14,
  });
  // add the DEM source as a terrain layer with exaggerated height
  map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
  await map.once('idle')
  console.log(map.queryTerrainElevation(modelOrigin, { exaggerated: true }))
});
