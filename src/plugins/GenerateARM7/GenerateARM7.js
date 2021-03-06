/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 1.7.0 from webgme on Mon Sep 19 2016 14:33:25 GMT-0500 (Central Daylight Time).
 * A plugin that inherits from the PluginBase. To see source code documentation about available
 * properties and methods visit %host%/docs/source/PluginBase.html.
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'common/util/ejs', // for ejs templates
    './Templates/Templates',
    'text!./static/project.bgproj',
    'text!./static/project.xml',
    'text!./static/attributes.txt',
    'text!./static/cdc.xml',
    'text!./static/config.xml',
    'text!./static/gatt.xml',
    'text!./static/hardware.xml',
    'text!./static/v1_uuids.txt',
    'text!./static/v4_uuids.txt',
    'hfsm/renderStates',
    'hfsm/modelLoader',
    'q'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    ejs,
    TEMPLATES,
    BGPROJ,
    PROJ,
    ATTRIBUTES,
    CDC,
    CONFIG,
    GATT,
    HARDWARE,
    V1UUIDS,
    V4UUIDS,
    renderer,
    loader,
    Q) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of GenerateARM7.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateARM7.
     * @constructor
     */
    var GenerateARM7 = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
        this.FILES = {
            'script.bgs': 'script.bgs.ejs'
        };
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateARM7.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateARM7.prototype = Object.create(PluginBase.prototype);
    GenerateARM7.prototype.constructor = GenerateARM7;

    GenerateARM7.prototype.notify = function(level, msg) {
	var self = this;
	var prefix = self.projectId + '::' + self.projectName + '::' + level + '::';
	var max_msg_len = 100;
	if (level=='error')
	    self.logger.error(msg);
	else if (level=='debug')
	    self.logger.debug(msg);
	else if (level=='info')
	    self.logger.info(msg);
	else if (level=='warning')
	    self.logger.warn(msg);
	self.createMessage(self.activeNode, msg, level);
	self.sendNotification(prefix+msg);
    };

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    GenerateARM7.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            nodeObject;

        // Default fails
        self.result.success = false;

	// the active node for this plugin is software -> project
	var projectNode = self.activeNode;
	self.projectName = self.core.getAttribute(projectNode, 'name');

	self.projectModel = {}; // will be filled out by loadProjectModel (and associated functions)
	self.artifacts = {}; // will be filled out and used by various parts of this plugin

	loader.logger = self.logger;
	renderer.initTemplates()

      	loader.loadModel(self.core, projectNode, true, true)
  	    .then(function (projectModel) {
		self.projectModel = projectModel.root;
		self.projectObjects = projectModel.objects;
        	return renderer.generateStateFunctions(self.projectModel, 'cpp');
  	    })
	    .then(function () {
		return loader.loadModel(self.core, projectNode, false, false);
	    })
	    .then(function (projectJSON) {
		self.projectJSON = projectJSON;
		return self.generateArtifacts();
	    })
	    .then(function () {
		self.notify('info', "Generated artifacts.");
        	self.result.setSuccess(true);
        	callback(null, self.result);
	    })
	    .catch(function (err) {
		self.notify('error', err);
        	self.result.setSuccess(false);
        	callback(err, self.result);
	    })
		.done();
    };

    GenerateARM7.prototype.generateArtifacts = function () {
	var self = this;

	self.projectModel.initStateCode = renderer.getSetState(self.projectModel.initState, 'bgs');

	self.artifacts[self.projectModel.name + '.json'] = JSON.stringify(self.projectJSON, null, 2);
        self.artifacts[self.projectModel.name + '_metadata.json'] = JSON.stringify({
    	    projectID: self.project.projectId,
            commitHash: self.commitHash,
            branchName: self.branchName,
            timeStamp: (new Date()).toISOString(),
            pluginVersion: self.getVersion()
        }, null, 2);

	var states = []
	for (var objPath in self.projectObjects) {
	    var obj = self.projectObjects[objPath];
	    if (obj.type == 'State') {
		states.push(obj);
	    }
	}

	var scriptTemplate = TEMPLATES[self.FILES['script.bgs']];
	self.artifacts['script.bgs'] = ejs.render(scriptTemplate, {
	    'model': self.projectModel,
	    'states': states
	});
	// re-render so that users' templates are accounted for
	self.artifacts['script.bgs'] = ejs.render(self.artifacts['script.bgs'], {
	    'model': self.projectModel,
	    'states': states
	});

	// make sure to render all libraries
	if (self.projectModel.Library_list) {
	    self.projectModel.Library_list.map(function(library) {
		var libFileName = library.name + '.bgs';
		self.artifacts[libFileName] = library.code;
		if (library.Event_list) {
		    library.Event_list.map(function(event) {
			self.artifacts[libFileName] += '\n'+event.function;
		    });
		}
	    });
	}

	// render all static files (needed for actually building and deploying)
	self.artifacts['project.bgproj'] = BGPROJ;
	self.artifacts['project.xml'] = PROJ;
	self.artifacts['attributes.txt'] = ATTRIBUTES;
	self.artifacts['cdc.xml'] = CDC;
	self.artifacts['config.xml'] = CONFIG;
	self.artifacts['gatt.xml'] = GATT;
	self.artifacts['hardware.xml'] = HARDWARE;
	self.artifacts['v1_uuids.txt'] = V1UUIDS;
	self.artifacts['v4_uuids.txt'] = V4UUIDS;

	var fileNames = Object.keys(self.artifacts);
	var artifact = self.blobClient.createArtifact('GeneratedFiles');
	var deferred = new Q.defer();
	artifact.addFiles(self.artifacts, function(err) {
	    if (err) {
		deferred.reject(err.message);
		return;
	    }
	    self.blobClient.saveAllArtifacts(function(err, hashes) {
		if (err) {
		    deferred.reject(err.message);
		    return;
		}
		self.result.addArtifact(hashes[0]);
		deferred.resolve();
	    });
	});
	return deferred.promise;
    };

    return GenerateARM7;
});
