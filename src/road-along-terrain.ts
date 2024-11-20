import mapboxgl, {CustomLayerInterface, LngLatLike, Map} from 'mapbox-gl';
import * as BABYLON from '@babylonjs/core/Legacy/legacy';
import '@babylonjs/loaders/glTF';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoibGl1ayIsImEiOiJjanczNmJoZjkwY3IxM3lxcTd1NmMwZWxjIn0.11SpcY8De0c1q6S3a-2Qcg';
const map = new mapboxgl.Map({
  container: 'map',
  zoom: 13,
  center: [6.58968, 45.39701],
  pitch: 76,
  bearing: 150,
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  antialias: true
});

function createRoad(points: BABYLON.Vector3[], scene: BABYLON.Scene) {
  const line = BABYLON.MeshBuilder.CreateLines('lines', {
    points,
  }, scene);
  line.color = new BABYLON.Color3(1, 0, 0);
}

class BabylonLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type: 'custom' = 'custom';
  readonly renderingMode: '3d' = '3d';

  private map: Map | undefined;
  private scene: BABYLON.Scene | undefined;
  private camera: BABYLON.Camera | undefined;

  points: Array<[number, number, number]>;

  constructor(id: string, points: Array<[number, number, number]>) {
    this.id = id;
    this.points = points;
  }

  onAdd = (map: Map, gl: WebGL2RenderingContext) => {
    this.map = map;
    const engine = new BABYLON.Engine(gl, true, {
      useHighPrecisionMatrix: true
    }, true);

    this.scene = new BABYLON.Scene(engine);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false
    this.scene.detachControl();
    this.scene.beforeRender = function(){
      engine.wipeCaches(true);
    };
    this.scene.ambientColor = new BABYLON.Color3(1, 1, 1);
    this.camera = new BABYLON.Camera("mapbox-camera", new BABYLON.Vector3(), this.scene);
    const light = new BABYLON.HemisphericLight("mapbox-light", new BABYLON.Vector3(0.5, 0.5, 4000), this.scene);
    const path = this.points.map((p) => {
      const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([p[0], p[1]], p[2]);
      return new BABYLON.Vector3(mercatorCoord.x, mercatorCoord.y, mercatorCoord.z);
    })
    const modelCoord = mapboxgl.MercatorCoordinate.fromLngLat([this.points[0][0], this.points[0][1]], this.points[0][2]);
    const scaleFactor = modelCoord.meterInMercatorCoordinateUnits() * 10;
    const position = new BABYLON.Vector3(modelCoord.x, modelCoord.y, modelCoord.z);
    BABYLON.SceneLoader.AppendAsync("./", "CAR.glb", this.scene).then(scene => {
      const mesh = scene.rootNodes[3] as BABYLON.Mesh;
      mesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
      mesh.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
      mesh.position = position;
    });
    createRoad(path, this.scene);
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
  // Start downloading the route data, and wait for map load to occur in parallel
  const [pinRouteGeojson] = await Promise.all([
    fetch('https://docs.mapbox.com/mapbox-gl-js/assets/route-pin.geojson').then(
      (response) => response.json()
    ),
  ]);
  // Add terrain source, with slight exaggeration
  map.addSource('mapbox-dem', {
    type: 'raster-dem',
    url: 'mapbox://mapbox.terrain-rgb',
    tileSize: 512,
    maxzoom: 14,
  });
  map.setTerrain({source: 'mapbox-dem', exaggeration: 1.5});
  const pinRoute = pinRouteGeojson.features[0].geometry.coordinates;
  // Add a line feature and layer. This feature will get updated as we progress the animation
  map.addSource('line', {
    type: 'geojson',
    // Line metrics is required to use the 'line-progress' property
    lineMetrics: true,
    data: pinRouteGeojson,
  });
  map.addLayer({
    type: 'line',
    source: 'line',
    id: 'line',
    paint: {
      'line-color': 'rgba(1,0,0,0)',
      'line-width': 5,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  });

  await map.once('idle');
  const points = pinRoute.map((point: number[]) => {
    const elevation = map.queryTerrainElevation(point as LngLatLike, {exaggerated: true});
    return [point[0], point[1], elevation ?? 0];
  })
  const babylonLayer = new BabylonLayer('babylon-layer', points);
  map.addLayer(babylonLayer);
});
