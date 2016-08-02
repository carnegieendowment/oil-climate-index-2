Map {
  buffer-size: 10;  
}

#flaregeojson["BCM 2012" > 0] {
  marker-allow-overlap: true;
  marker-ignore-placement: true;
  marker-line-opacity: 0;
  marker-width: 3;
  marker-opacity: .25;
  direct-image-filters: agg-stack-blur(2,2);
  [zoom>=5] { marker-width: 4; }
  [zoom>=7] { marker-width: 5; }
  [zoom>=9] { marker-width: 6; }
  [zoom>=10] { marker-width: 8; }
  [zoom>=12] { marker-width: 16; }
  [zoom>=14] { marker-width: 32; }
  [zoom>=15] { marker-width: 64; }
  [zoom>=16] { marker-width: 128; }
  [zoom>=17] { marker-width: 256; }
  [zoom>=18] { marker-width: 512; }
  
  [zoom>=4] { marker-opacity: .4; }
  [zoom>=6] { marker-opacity: .6; }
  
  marker-fill: #ffffb2;
  ["BCM 2012" > 0.001] { marker-fill: #fed976; }
  ["BCM 2012" > 0.002] { marker-fill: #feb24c; }
  ["BCM 2012" > 0.003] { marker-fill: #fd8d3c; }
  ["BCM 2012" > 0.004] { marker-fill: #f03b20; }
}

