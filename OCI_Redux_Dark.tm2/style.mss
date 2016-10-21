// Languages: name (local), name_en, name_fr, name_es, name_de
@name: '[name_en]';

// Fonts //
@fallback: 'Open Sans Regular';
@sans: 'Open Sans Regular', 'Arial Unicode MS Regular';
@sans_md: 'Open Sans Semibold', 'Arial Unicode MS Regular';
@sans_bd: 'Open Sans Bold','Arial Unicode MS Bold';
@sans_it: 'Open Sans Italic', 'Arial Unicode MS Regular';
@sans_bdit: 'Open Sans Bold Italic','Arial Unicode MS Bold';

/*
This style is designed to be easily recolored by adjusting the color
variables below. For predicatable feature relationships,
maintain or invert existing value (light to dark) scale.
*/
// Color palette //
@road:  #484848;
@land:  #121026;

@fill1: #000000;
@fill2: #444444;
@fill3: #888888;
@fill4: #ffffff;
@fill5: #7a7a7a;

@text: #888888;

Map { background-color: @land; }


#mapbox_satellite_full,
#mapbox_satellite_watermask  {
  raster-opacity: 0;
    [zoom>=3] { raster-opacity: 0.08; }
    [zoom>=4] { raster-opacity: 0.14; }
    [zoom>=5] { raster-opacity: 0.22; }
    [zoom>=6] { raster-opacity: 0.35; }
    [zoom>=7] { raster-opacity: 0.45; }
    [zoom>=8] { raster-opacity: 0.7; }
    [zoom>=9] { raster-opacity: 0.9; }
    [zoom>=10] { raster-opacity: 1; } 
}



// Political boundaries //
#admin[admin_level=2][maritime=0] {
  line-join: round;
  line-color: @fill2;
  line-width: 0.5;
  [zoom>=3] { line-width: 0.8; }
  [zoom>=5] { line-width: 1; line-color: lighten(@fill2, 10);}
  [zoom>=6] { line-width: 1.8; line-color: lighten(@fill2, 25); }
  [zoom>=7] { line-color: lighten(@fill2, 30); }
  [zoom>=8] { line-width: 2; line-color: lighten(@fill2, 50); }
  [zoom>=9] { line-color: lighten(@fill2, 50); }
  [zoom>=10] { line-width: 3; }
  [disputed=1] { line-dasharray: 4,4; }
}

/*
#admin[admin_level>2][maritime=0] {
  line-join: round;
  line-color: @fill2;
  line-width: 0.5;
  line-dasharray: 3,2;
  [zoom>=5] { line-color: lighten(@fill2, 10); }
  [zoom>=6] { line-width: 1.5; line-color: lighten(@fill2, 25); }
  [zoom>=7] { line-color: lighten(@fill2, 30); }
  [zoom>=8] { line-width: 1.8; line-color: lighten(@fill2, 50); }
  [zoom>=9] { line-color: lighten(@fill2, 100); }
}
*/

// Land Features //
#landuse[class='cemetery'],
#landuse[class='park'],
#landuse[class='wood'],
#landuse_overlay {
  polygon-fill: darken(@land,3);
  [zoom>=15] { polygon-fill:mix(@land,@fill4,95); }
}

#landuse[class='pitch'],
#landuse[class='sand'] { 
  polygon-fill: mix(@land,@fill4,90);
}

#landuse[class='hospital'],
#landuse[class='industrial'],
#landuse[class='school'] { 
  polygon-fill: mix(@land,@fill1,95);
}

@water: #062544;

// Water Features //
#water {
    polygon-fill: #354456;
}

// Water color is calculated by sampling the resulting color from
// the soft-light comp-op in the #water layer style above. 