/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 1.7.0 from webgme on Fri Sep 09 2016 09:21:15 GMT-0500 (Central Daylight Time).
 * A plugin that inherits from the PluginBase. To see source code documentation about available
 * properties and methods visit %host%/docs/source/PluginBase.html.
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'common/util/ejs', // for ejs templates
    './templates/Templates',
    'hfsm/renderStates',
    'hfsm/modelLoader',
    'q'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    ejs,
    TEMPLATES,
    renderer,
    loader,
    Q) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of GenerateBLE113.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin GenerateBLE113.
     * @constructor
     */
    var GenerateBLE113 = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    GenerateBLE113.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    GenerateBLE113.prototype = Object.create(PluginBase.prototype);
    GenerateBLE113.prototype.constructor = GenerateBLE113;

    GenerateBLE113.prototype.notify = function(level, msg) {
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
    GenerateBLE113.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            nodeObject;

        // Default fails
        self.result.success = false;

	var currentConfig = self.getCurrentConfig();
	self.language = currentConfig.language;

	// the active node for this plugin is software -> project
	var projectNode = self.activeNode;
	self.projectName = self.core.getAttribute(projectNode, 'name');

	// artifact name that will be returned
	self.artifactName = self.project.projectId + '+' + self.branchName + '+' + self.projectName + '_generatedCode';

	self.projectModel = {}; // will be filled out by loadProjectModel (and associated functions)
	self.artifacts = {}; // will be filled out and used by various parts of this plugin

	loader.logger = self.logger;
	renderer.initTemplates()

      	loader.loadModel(self.core, projectNode, true, true)
  	    .then(function (projectModel) {
		self.projectModel = projectModel.root;
		self.projectObjects = projectModel.objects;
        	return renderer.generateStateFunctions(self.projectModel, self.language);
  	    })
	    .then(function () {
		return loader.loadModel(self.core, projectNode, false, false);
	    })
	    .then(function (projectJSON) {
		self.projectJSON = projectJSON;
	    })
	    .then(function () {
		return self.blobClient.getObjectAsString(self.projectModel.services)
		    .then(function(serviceString) {
			if (self.language == 'bgs') {
			    self.artifacts['bgs/gatt.xml'] = serviceString;
			}
			else if (self.language == 'c') {
			    self.artifacts['c/config/gatt.xml'] = serviceString;
			}
		    });
	    })
	    .then(function () {
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

    GenerateBLE113.prototype.generateArtifacts = function () {
	var self = this;

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

	var selectedArtifactKeys = Object.keys(TEMPLATES).filter(function(key) { return key.startsWith(self.language + '/'); });
	
	selectedArtifactKeys.map(function(key) {
	    self.artifacts[key] = ejs.render(TEMPLATES[key], {
		'model': self.projectModel,
		'states': states
	    });
	    // re-render so that users' templates are accounted for
	    self.artifacts[key] = ejs.render(self.artifacts[key], {
		'model': self.projectModel,
		'states': states
	    });
	});

	// make sure to render all libraries
	if (self.projectModel.Library_list) {
	    self.projectModel.Library_list.map(function(library) {
		if ( self.language == 'bgs') {
		    var libFileName = 'bgs/'+library.name + '.bgs';
		    self.artifacts[libFileName] = library.code;
		    if (library.Event_list) {
			library.Event_list.map(function(event) {
			    self.artifacts[libFileName] += '\n'+event.function;
			});
		    }
		}
		else if ( self.language == 'c' ) {
		    var prefix = 'c/src/';
		    var headerFileName = library.name + '.h';
		    var includeGuard = library.name.toUpperCase() + '_INCLUDE_GUARD_';
		    self.artifacts[prefix+headerFileName] = "#ifndef " + includeGuard + "\n#define " + includeGuard +'\n';
		    self.artifacts[prefix+headerFileName] += library.definitions;
		    if (library.Event_list) {
			library.Event_list.map(function(event) {
			    self.artifacts[prefix+headerFileName] += '\n'+event.definition;
			});
		    }
		    self.artifacts[prefix+headerFileName] += "\n#endif //"+includeGuard;

		    var sourceFileName = library.name + '.c';
		    self.artifacts[prefix+sourceFileName] = '#include "' + headerFileName + '"';
		    if (library.Event_list) {
			library.Event_list.map(function(event) {
			    self.artifacts[prefix+sourceFileName] += '\n'+event.function;
			});
		    }
		    self.artifacts[prefix+sourceFileName] += '\n' + library.code;
		}
	    });
	}

	var fileNames = Object.keys(self.artifacts);
	var artifact = self.blobClient.createArtifact(self.artifactName);
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

    return GenerateBLE113;
});
