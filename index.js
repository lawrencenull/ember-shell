/* jshint node: true */
'use strict';

var path = require('path');
var Funnel = require('broccoli-funnel');
var Rollup = require('broccoli-rollup');
var mergeTrees = require('broccoli-merge-trees');
var broccoliPostcss = require('broccoli-postcss');
var { preprocessTemplates} = require('ember-cli-preprocess-registry/preprocessors');
var { WatchedDir } = require('broccoli-source');

module.exports = {
  name: 'ember-shell',

  init(){
    this._super(...arguments);
    this.packagesPath = this.isAddon() ?
        path.join(this.project.root, 'packages') :
        path.join(this.project.nodeModulesPath, this.name, 'packages');

    this.treeForMethods['addon-styles'] = 'treeForAddonStyles';
    this.treeForMethods['addon-templates'] = 'treeForAddonTemplates';
  },

  isDevelopingAddon: function(){
    return true;
  },

  /*included: function (app) {
    this._super.included.apply(this, arguments);
  },*/

  treeForApp: function() {
    var tree = this._super.treeForApp.apply(this, arguments);
    var packagesPath = this.packagesPath;

    var packages = require(packagesPath + '/index.js');
    var addonApp = [];

    packages.forEach(function(pkg) {
      var pkgApp = path.join(packagesPath, pkg.name, 'app');
      addonApp.push(new WatchedDir(pkgApp));
    });

    var addonAppTree = mergeTrees(addonApp);

    return tree ? mergeTrees([tree, addonAppTree]) : addonAppTree;
  },

  treeForAddon: function() {
    this._requireBuildPackages();

    var packagesPath = this.packagesPath;
    var packages = require(packagesPath + '/index.js');

    var addonJS = [];
    var addonHbs = [];

    packages.forEach(function(pkg){
      var pkgLib = path.join(packagesPath, pkg.name, 'lib');
      var pkgTemplates = path.join(pkgLib, 'templates');

      addonJS.push(new Rollup(pkgLib, {
        rollup: {
          entry: 'index.js',
          dest: pkg.module + '.js',
          external: pkg.externals
        },
        annotation: pkg.module
      }));

      if(pkg.hasTemplates){
        addonHbs.push(new Funnel(pkgTemplates, {
          include: [
            '*.hbs',
            '**/*.hbs'
          ],
          srcDir: '/',
          destDir: 'modules/ember-shell/templates/'+ pkg.module
        }));
      }
    });

    var addonJsTree = this.processedAddonJsFiles(mergeTrees(addonJS));
    var addonHbsTree = this.compileTemplates(mergeTrees(addonHbs));

    var emberShellTrees = mergeTrees([addonHbsTree, addonJsTree]);
    var stylesTree = this.compileStyles(this._treeFor('addon-styles'));

    return mergeTrees([emberShellTrees, stylesTree], {
      annotation: 'Addon#treeForAddon(' + this.name + ')'
    });
  },

  compileTemplates: function(tree) {
    this._requireBuildPackages();
    return preprocessTemplates(tree, {
      annotation: 'compileTemplates(ember-shell)',
      registry: this.registry
    });
  },

  shouldCompileTemplates: function() {
    return true;
  },

  treeForAddonStyles: function () {
    var stylesPath = path.join(this.packagesPath, 'shell-styles');
    var inputTree = new Funnel(stylesPath, {
      files: ['ember-shell.css'],
      srcDir: '/',
      destDir: 'ember-shell',

      getDestinationPath: function() {
        return 'shell-styles.css';
      }
    });

    var options = {
      plugins: [
        { module: require('postcss-import'), options: {
            path: stylesPath,
            plugins: []
        }},
        { module: require('postcss-cssnext'), options: {
          features: {
            customProperties: false
          }
        }},
        { module: require('cssnano'), options: {
            autoprefixer: false
        }}
      ],
      map:{ inline: true }
    }

    return broccoliPostcss(inputTree, options);
  },

  isAddon: function () {
    var keywords = this.project.pkg.keywords;
    return (keywords && keywords.indexOf('ember-addon') !== -1);
  }

};
