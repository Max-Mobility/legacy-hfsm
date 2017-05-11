'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

config.server.port = 8080;

//config.seedProjects.defaultProject = 'FiniteStateMachine';
config.seedProjects.basePaths = [__dirname + '/../src/seeds'];

config.requirejsPaths.hfsm = "./src/common";

config.requirejsPaths['webgme-to-json'] = "./node_modules/webgme-to-json";
config.requirejsPaths['cytoscape'] = "./node_modules/cytoscape/dist"
config.requirejsPaths['handlebars'] = "./node_modules/handlebars/"
config.requirejsPaths['cytoscape-cose-bilkent'] = "./node_modules/cytoscape-cose-bilkent/"

config.authentication.enable = true;
config.authentication.allowGuests = true;

config.plugin.allowBrowserExecution = true;
config.plugin.allowServerExecution = true;

validateConfig(config);
module.exports = config;
