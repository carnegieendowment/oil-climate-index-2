#flaregeojson {
  marker-allow-overlap: true;
  marker-ignore-placement: true;
  marker-line-opacity: 0;
  marker-width: 3;
  marker-opacity: .05;
  marker-fill: red;
  direct-image-filters: agg-stack-blur(2,2);
  [zoom>=5] { marker-width: 5; }
  [zoom>=7] { marker-width: 7; }
  
  [zoom>=6] { marker-opacity: .25; }
  [zoom>=8] { marker-opacity: .4; }
}

