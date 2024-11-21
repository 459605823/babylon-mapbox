import mapboxgl, {CustomLayerInterface, LngLatLike, Map} from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders/glTF';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  zoom: 18,
  center: [148.9819, -35.39847],
  pitch: 60,
  antialias: true, // create the gl context with MSAA antialiasing, so custom layers are antialiased
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
    const engine = new BABYLON.Engine(
      gl,
      true,
      {
        useHighPrecisionMatrix: true,
      },
      true
    );

    this.scene = new BABYLON.Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
    this.scene.detachControl();
    this.scene.registerAfterRender(() => {
      engine.wipeCaches(true);
    });

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
    // parameters to ensure the model is georeferenced correctly on the map
    const modelOrigin = [148.9819, -35.39847] as LngLatLike;
    const modelAltitude = 0;
    const modelRotate = [0, 0, 0];
    const modelCoords = mapboxgl.MercatorCoordinate.fromLngLat(
      modelOrigin,
      modelAltitude
    );
    const modelScale = modelCoords.meterInMercatorCoordinateUnits();
    this.modelMatrix = BABYLON.Matrix.Compose(
      new BABYLON.Vector3(modelScale, modelScale, modelScale),
      BABYLON.Quaternion.FromEulerAngles(
        modelRotate[0],
        modelRotate[1],
        modelRotate[2]
      ),
      new BABYLON.Vector3(modelCoords.x, modelCoords.y, modelCoords.z)
    );

    const world = new BABYLON.TransformNode("world", this.scene);
    const axes = new BABYLON.Debug.AxesViewer(this.scene, 50, 1)
    axes.xAxis.parent = world;
    axes.yAxis.parent = world;
    axes.zAxis.parent = world;

    const sphereLngLat = [148.9777636551289, -35.39853326893468] as LngLatLike;
    const sphereCoord = mapboxgl.MercatorCoordinate.fromLngLat(sphereLngLat, 970);
    const x = (sphereCoord.x - modelCoords.x) / modelScale;
    const y = (sphereCoord.y - modelCoords.y) / modelScale;
    const z = (sphereCoord.z - modelCoords.z) / modelScale;
    const sphereMesh = BABYLON.MeshBuilder.CreateSphere('sphere', {
      diameter: 10
    }, this.scene);
    sphereMesh.position = new BABYLON.Vector3(x, y, z);
    sphereMesh.renderingGroupId = 1
    sphereMesh.parent = world;
    BABYLON.SceneLoader.AppendAsync("./", "CAR.glb", this.scene).then(scene => {
      const mesh = scene.rootNodes[3] as BABYLON.Mesh;
      mesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
      mesh.position = new BABYLON.Vector3(x, y, z);
      mesh.scaling.setAll(10)
      mesh.parent = world;
    });

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

map.on('click', e => {
  console.log(e)
})

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
  map.setTerrain({source: 'mapbox-dem', exaggeration: 1.5});
  await map.once('idle');
  console.log(map.queryTerrainElevation([148.9777636551289, -35.39853326893468], {exaggerated: true}));
});
