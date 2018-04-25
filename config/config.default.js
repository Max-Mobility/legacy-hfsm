'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

config.server.port = 9090;

//config.seedProjects.defaultProject = 'FiniteStateMachine';
config.seedProjects.basePaths = [__dirname + '/../src/seeds'];

config.requirejsPaths.hfsm = "./src/common";

config.requirejsPaths['webgme-to-json'] = "./node_modules/webgme-to-json";
config.requirejsPaths['mustache'] = "./node_modules/mustache";
config.requirejsPaths['bower'] = "./bower_components/";
config.requirejsPaths['cytoscape-panzoom'] = "./bower_components/cytoscape-panzoom/cytoscape-panzoom";

config.authentication.enable = true;
config.authentication.allowGuests = true;

config.plugin.allowBrowserExecution = true;
config.plugin.allowServerExecution = true;

validateConfig(config);
module.exports = config;
