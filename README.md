# Oil Climate Index

## Site Updates

See the following documents for more information:
- [Data Processing](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/PROCESSING.md)
- [Copy Edits](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/COPY.md)
- [Geospatial Data](https://github.com/carnegieendowment/oil-climate-index-2/blob/master/GEO.md)

## Development environment
To set up the development environment for this website, you'll need to install the following on your system:

- [Node and npm](http://nodejs.org/)
- Gulp ( $ npm install -g gulp)

After these basic requirements are met, run the following commands in the website's folder:
```
$ npm install

```

### Commands

Spins up a webserver to serve the website.
```
$ npm run serve
```

Compile the sass files and javascript.
```
$ npm run build
```

### Deployment
Running `npm run build` will build the site and put all the assets into a `dist` directory. That directory can be served statically from any server. 
