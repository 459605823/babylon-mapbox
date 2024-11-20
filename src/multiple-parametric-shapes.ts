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

function createRibbonPolygon(points: Array<[number, number, number]>, scene: BABYLON.Scene) {
  const pathPoints = points.map((p) => {
    const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([p[0], p[1]], p[2]);
    // x-y plane -> left hand coordinate system z-x plane
    return new BABYLON.Vector3(mercatorCoord.y, mercatorCoord.z, mercatorCoord.x);
  });
  const halfCount = Math.floor(pathPoints.length / 2)
  const path0 = pathPoints.slice(0, halfCount)
  const path1 = pathPoints.slice(halfCount).reverse()
  // ribbon path array needs same length
  if (pathPoints.length % 2 === 1) path1.shift()

  const ribbonMesh = BABYLON.MeshBuilder.CreateRibbon('ribbon-polygon', {
    pathArray: [path0, path1],
    sideOrientation: BABYLON.Mesh.DOUBLESIDE
  }, scene);
  // z-x plane rotate to x-y plane
  ribbonMesh.rotateAround(BABYLON.Vector3.Zero(), new BABYLON.Vector3(1, 0, 0), Math.PI / 2)
    .rotateAround(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, 1), Math.PI / 2);
}

function createDashedLines(points: Array<[number, number, number]>, scene: BABYLON.Scene) {
  const dashedlinesMesh = BABYLON.MeshBuilder.CreateDashedLines('dashedlines', {
    points: points.map((p) => {
      const mercatorCoord = mapboxgl.MercatorCoordinate.fromLngLat([p[0], p[1]], p[2]);
      // x-y plane -> left hand coordinate system z-x plane
      return new BABYLON.Vector3(mercatorCoord.y, mercatorCoord.z, mercatorCoord.x);
    }),
    dashNb: 100
  }, scene);
  dashedlinesMesh.color = new BABYLON.Color3(1, 0, 0);
  // z-x plane rotate to x-y plane
  dashedlinesMesh.rotateAround(BABYLON.Vector3.Zero(), new BABYLON.Vector3(1, 0, 0), Math.PI / 2)
    .rotateAround(BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, 1), Math.PI / 2);
}

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

    const points: Array<[number, number, number]> = [
      [
        148.9819,
        -35.39847,
        0
      ],
      [
        148.9719,
        -35.39847,
        400,
      ],
      [
        148.9719,
        -35.38847,
        200,
      ],
      [
        148.9819,
        -35.38847,
        800
      ],
      [
        148.9819,
        -35.39847,
        0
      ]
    ];
    createRibbonPolygon(points, this.scene);
    createDashedLines(points, this.scene);
  }

  render = (gl: WebGL2RenderingContext, matrix: number[]) => {
    // projection & view matrix
    const cameraMatrix = BABYLON.Matrix.FromArray(matrix);
    this.camera!.freezeProjectionMatrix(cameraMatrix);

    this.scene!.render(false);
    this.map!.triggerRepaint();
  }
}

map.on('style.load', () => {
  const babylonLayer = new BabylonLayer('babylon-layer');
  map.addLayer(babylonLayer);
  map.addSource("mapbox-dem", {
    type: "raster-dem",
    url: "mapbox://mapbox.terrain-rgb",
    tileSize: 512,
    maxzoom: 14,
  });
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1 });
});