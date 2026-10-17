//   PASSO 1 — EUCROPMAP 

// --- Area di studio: bassa bolognese (Medicina - Molinella) ---
var aoi = ee.Geometry.Rectangle([11.55, 44.42, 11.90, 44.68]);
Map.centerObject(aoi, 11);
Map.addLayer(aoi, {color: 'red'}, 'AOI', true, 0.4);

// --- Caricamento della collezione ---
var collezione = ee.ImageCollection('JRC/D5/EUCROPMAP/V1');
print('Immagini nella collezione:', collezione.size());

// --- L'immagine 2022 ---
var crop2022 = ee.Image(collezione.filterDate('2022-01-01', '2023-01-01').first());
print('Immagine 2022:', crop2022);

// --- LEGENDA  
print('Valori delle classi:', crop2022.get('classification_class_values'));
print('Nomi delle classi:',  crop2022.get('classification_class_names'));

 
var crop = crop2022.select('classification').clip(aoi);
Map.addLayer(crop, {}, 'EUCROPMAP 2022');

 
var FRUMENTO_TENERO = 211;
var MAIS            = 216;

var mFrumento = crop.eq(FRUMENTO_TENERO).selfMask();
var mMais     = crop.eq(MAIS).selfMask();

 

// ETTARI PER CLASSE
function ettari(maschera, etichetta) {
  var a = ee.Image.pixelArea().divide(10000)
    .updateMask(maschera)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 10,
      maxPixels: 1e10
    });
  print(etichetta, a);
}
ettari(mFrumento, 'Ettari frumento tenero:');
ettari(mMais,     'Ettari mais:');

// ===== PASSO 2 — Erosione e campionamento =====
 
 
 // =====================================================================
// FRUMENTO TENERO vs MAIS — curve NDVI 2022 — bassa bolognese
// Dati: JRC EUCROPMAP 2022 (CC-BY-4.0), Copernicus Sentinel-2
// =====================================================================

// ---------- 0. PARAMETRI ----------
var AOI = ee.Geometry.Rectangle([11.55, 44.42, 11.90, 44.68]);
var FRUMENTO = 211;
var MAIS     = 216;
var ASSET_PUNTI = 'projects/ee-leonardobonfiglioli02/assets/punti_frumento_mais_2022';

Map.centerObject(AOI, 11);

// ---------- 1. MAPPA COLTURALE ----------
var crop = ee.Image(
    ee.ImageCollection('JRC/D5/EUCROPMAP/V1')
      .filterDate('2022-01-01', '2022-12-31')
      .first()
  ).select('classification').clip(AOI);



// ---------- 2. EROSIONE 5x5 ----------
var bFrumento = crop.eq(FRUMENTO);
var bMais     = crop.eq(MAIS);

var eFrumento = bFrumento.focalMin({radius: 2, kernelType: 'square', units: 'pixels'});
var eMais     = bMais.focalMin({radius: 2, kernelType: 'square', units: 'pixels'});

 
Map.addLayer(bFrumento.selfMask(), {palette: ['d9a441']}, '2a - Frumento INTERO', false);
Map.addLayer(eFrumento.selfMask(), {palette: ['5c3f00']}, '2b - Frumento EROSO',  false);
Map.addLayer(bMais.selfMask(),     {palette: ['ffe680']}, '2c - Mais INTERO',     false);
Map.addLayer(eMais.selfMask(),     {palette: ['a08500']}, '2d - Mais EROSO',      false);

var classi = eFrumento.add(eMais.multiply(2))
                      .selfMask().rename('classe').int8();

Map.addLayer(classi, {min: 1, max: 2, palette: ['a57000', 'ffd300']},
             '2e - Pixel puri', true);

// ---------- 2b. SUPERFICI ----------


function ettari(img, etichetta) {
  var conteggio = img.selfMask().rename('n').reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: AOI,
    scale: 10,
    maxPixels: 1e10
  });
  print(etichetta, ee.Number(conteggio.get('n')).divide(100));
}

ettari(bFrumento, 'Frumento INTERO (ha):');
ettari(eFrumento, 'Frumento EROSO  (ha):');
ettari(bMais,     'Mais INTERO     (ha):');
ettari(eMais,     'Mais EROSO      (ha):');

// ---------- 3. PUNTI  
var punti = ee.FeatureCollection(ASSET_PUNTI);

print('Punti totali:', punti.size());
print('Per classe:',  punti.aggregate_histogram('classe'));

Map.addLayer(punti.filter(ee.Filter.eq('classe', 1)),
             {color: 'a57000'}, '3a - Punti frumento', true);
Map.addLayer(punti.filter(ee.Filter.eq('classe', 2)),
             {color: 'ffd300'}, '3b - Punti mais', true);

// ---------- 4. LEGENDA E ZOOM  
var legenda = ui.Panel();
legenda.style().set('position', 'bottom-left');
legenda.style().set('padding', '8px');
legenda.add(ui.Label('EUCROPMAP 2022'));

var colori = ['a57000', '896054', 'e2007c', 'ffd300', '267000',
              'a800e2', 'e8bfff', 'e8ffbf', '696969', '93cc93',
              'ff130f', '0793de'];
var nomi = ['211 Frumento tenero', '212 Frumento duro', '213 Orzo',
            '216 Mais', '233 Soia', '222 Barbabietola',
            '250 Foraggere', '500 Prati', '290 Seminativo nudo',
            '300 Bosco e arboree', '100 Artificiale', '700 Acqua'];

for (var i = 0; i < colori.length; i++) {
  var q = ui.Label('   ');
  q.style().set('backgroundColor', '#' + colori[i]);
  q.style().set('padding', '8px');
  q.style().set('margin', '2px');
  var t = ui.Label(nomi[i]);
  t.style().set('margin', '4px 0 0 6px');
  t.style().set('fontSize', '12px');
  legenda.add(ui.Panel([q, t], ui.Panel.Layout.Flow('horizontal')));
}
Map.add(legenda);

var etZoom = ui.Label('Zoom: ' + Map.getZoom());
etZoom.style().set('position', 'top-left');
etZoom.style().set('backgroundColor', 'white');
Map.add(etZoom);
Map.onChangeZoom(function(z) { etZoom.setValue('Zoom: ' + z); });

// =====================================================================
// ARCHIVIO — campionamento ed export, già eseguiti il 2026-10-05.
// Non rieseguire: i 500 punti sono congelati nell'asset.
// Conservato per riproducibilità (repository GitHub).
// =====================================================================
/*
var punti = classi.stratifiedSample({
  numPoints: 250, classBand: 'classe', region: AOI,
  scale: 10, seed: 42, geometries: true, dropNulls: true, tileScale: 4
});

Export.table.toAsset({
  collection: punti,
  description: 'punti_frumento_mais_2022',
  assetId: 'punti_frumento_mais_2022'
});
*/

 
 
 // ===== Caricamento dei punti dall'asset =====
 var punti = ee.FeatureCollection('projects/ee-leonardobonfiglioli02/assets/punti_frumento_mais_2022');

print('Numero punti caricati:', punti.size());
print('Esempio di punto:', punti.first());
Map.addLayer(punti, {color: 'red'}, 'Punti campionati (asset)');          
         
         
 
Map.addLayer(bFrumento.subtract(eFrumento).selfMask(),
             {palette: ['ff0000']}, '2f - Cornice persa frumento', false);
Map.addLayer(bMais.subtract(eMais).selfMask(),
             {palette: ['ff00ff']}, '2g - Cornice persa mais', false);
             
             
             // =====================================================================
// PASSO 3 — Serie temporale NDVI da Sentinel-2
// =====================================================================

var INIZIO    = ee.Date('2021-10-01');   // prima della semina del frumento
var FINE      = ee.Date('2022-10-31');   // dopo la raccolta del mais
var SOGLIA_CS = 0.60;                    // Cloud Score+: 0 = inutilizzabile, 1 = limpido

// ---------- 3.1 Collezione mascherata ----------
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(AOI)
    .filterDate(INIZIO, FINE);

var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');

var ndviPulito = s2.linkCollection(csPlus, ['cs_cdf']).map(function(img) {
  var limpido = img.select('cs_cdf').gte(SOGLIA_CS);
  return img.normalizedDifference(['B8', 'B4'])
            .rename('NDVI')
            .updateMask(limpido)
            .copyProperties(img, ['system:time_start']);
});

print('Immagini Sentinel-2 nel periodo:', s2.size());

// ---------- 3.2 Compositi decadali ----------
var nDecadi = FINE.difference(INIZIO, 'day').divide(10).floor();
var vuota = ee.Image.constant(0).rename('NDVI').float()
              .updateMask(ee.Image.constant(0));

var decadali = ee.ImageCollection.fromImages(
  ee.List.sequence(0, nDecadi.subtract(1)).map(function(i) {
    var d0  = INIZIO.advance(ee.Number(i).multiply(10), 'day');
    var sub = ndviPulito.filterDate(d0, d0.advance(10, 'day'));
    var img = ee.Image(ee.Algorithms.If(sub.size().gt(0), sub.median(), vuota));
    return img.set({
      data: d0.format('YYYY-MM-dd'),
      n_img: sub.size(),
      'system:time_start': d0.millis()
    });
  })
);

print('Decadi generate:', decadali.size());
 
 // ---------- 3.2b Diagnostica decadi (leggera) ----------
var diag = ee.FeatureCollection(decadali.map(function(img) {
  return ee.Feature(null, {data: img.get('data'), n_img: img.get('n_img')});
}));
print('Decadi e numero di immagini:', diag);

// ---------- 3.3 Anteprima su campione ridotto ----------
var campione = punti.randomColumn('r', 42).filter(ee.Filter.lt('r', 0.2));

var grafico = ui.Chart.image.seriesByRegion({
  imageCollection: decadali,
  regions: campione,
  reducer: ee.Reducer.median(),
  band: 'NDVI',
  scale: 10,
  xProperty: 'system:time_start',
  seriesProperty: 'classe'
}).setOptions({
  title: 'NDVI mediano — 1 = frumento tenero, 2 = mais',
  vAxis: {title: 'NDVI', viewWindow: {min: 0, max: 1}},
  hAxis: {title: 'Data'},
  lineWidth: 2,
  pointSize: 3,
  colors: ['a57000', 'ffd300']
});
print(grafico);

// ---------- 3.4 Estrazione punto per punto ----------
var tabella = ee.FeatureCollection(decadali.map(function(img) {
  var data = img.get('data');
  return img.reduceRegions({
    collection: punti,
    reducer: ee.Reducer.first().setOutputs(['ndvi']),
    scale: 10,
    tileScale: 4
  }).map(function(f) {
    return f.set('data', data);
  });
}).flatten()).filter(ee.Filter.notNull(['ndvi']));

// ---------- 3.5 Export ----------
Export.table.toDrive({
  collection: tabella.select(['classe', 'data', 'ndvi'], null, false),
  description: 'ndvi_frumento_mais_2022',
  fileNamePrefix: 'ndvi_frumento_mais_2022',
  fileFormat: 'CSV'
});

Export.table.toDrive({collection: diag, description: 'diagnostica_decadi', fileFormat: 'CSV'});