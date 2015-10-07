/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 1.0.0 from webgme on Mon Oct 05 2015 14:25:48 GMT-0500 (Central Daylight Time).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/util/ejs',
    'common/util/xmljsonconverter',
    'plugin/FSMCodeGenerator/FSMCodeGenerator/Templates/Templates',
    'q'
], function (
    PluginConfig,
    PluginBase,
    ejs,
    Converter,
    TEMPLATES,
    Q) {
    'use strict';

    /**
     * Initializes a new instance of FSMCodeGenerator.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin FSMCodeGenerator.
     * @constructor
     */
    var FSMCodeGenerator = function () {
        // Call base class' constructor.
        PluginBase.call(this);

        this.LANGUAGES = [
            {
                name: 'CSharp',
                generated: 'csharp.generated.cs.ejs',
                batFile: 'csharp.bat.ejs',
                static: 'csharp.simulator.cs.ejs',
                fileExtension: 'cs'
            },
            {
                name: 'Python',
                generated: 'python.generated.py.ejs',
                batFile: 'python.bat.ejs',
                static: 'python.simulator.cs.ejs',
                fileExtension: 'py'
            },
            {
                name: 'C++',
                generated: 'c++.generated.cpp.ejs',
                batFile: 'c++.bat.ejs',
                static: 'c++.simulator.cs.ejs',
                fileExtension: 'cpp'
            },
            {
                name: 'JavaScript',
                generated: 'javascript.generated.js.ejs',
                batFile: 'javascript.bat.ejs',
                static: 'javascript.simulator.cs.ejs',
                fileExtension: 'js'
            }
        ];
    };

    // Prototypal inheritance from PluginBase.
    FSMCodeGenerator.prototype = Object.create(PluginBase.prototype);
    FSMCodeGenerator.prototype.constructor = FSMCodeGenerator;

    /**
     * Gets the name of the FSMCodeGenerator.
     * @returns {string} The name of the plugin.
     * @public
     */
    FSMCodeGenerator.prototype.getName = function () {
        return 'FSM Code Generator';
    };

    /**
     * Gets the semantic version (semver.org) of the FSMCodeGenerator.
     * @returns {string} The version of the plugin.
     * @public
     */
    FSMCodeGenerator.prototype.getVersion = function () {
        return '0.2.0';
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
    FSMCodeGenerator.prototype.main = function (callback) {
        var self = this;

        if (self.core.getPath(self.activeNode) === '' ||
            self.core.getAttribute(self.getMetaType(self.activeNode), 'name') !== 'UMLStateMachine') {
            //self.createMessage(self.activeNode, 'Active node is not a "UMLStateMachine".', 'error');
            callback(new Error('Active node is not a "UMLStateMachine".'), self.result);
            return;
        }

        self.generateDataModel(self.activeNode)
            .then(function (dataModel) {
                self.logger.info(JSON.stringify(dataModel, null, 4));
                return self.generateArtifact(dataModel);
            })
            .then(function () {
                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch(function (err) {
                self.logger.error(err);
                self.createMessage(null, err.message, 'error');
                self.result.setSuccess(false);
                callback(null, self.result);
            })
            .done();
    };

    FSMCodeGenerator.prototype.generateDataModel = function (fsmNode) {
        var self = this,
            deferred = new Q.defer(),
            dataModel = {
                stateMachine: {
                    name: self.core.getAttribute(fsmNode, 'name'),
                    initialState: null,
                    finalStates: [],
                    states: [
                        //id: <nodePathStr>
                        //name: <string>
                        //events: []
                    ]
                }
            };


        self.core.loadChildren(fsmNode, function (err, children) {
            if (err) {
                deferred.reject(new Error(err));
                return;
            }
            var statePromises = [],
                i,
                metaType;

            for (i = 0; i < children.length; i += 1) {
                if (self.isMetaTypeOf(children[i], self.META.StateBase) === true) {

                    statePromises.push(self.getStateData(children[i]));
                    metaType = self.core.getAttribute(self.getMetaType(children[i]), 'name');

                    if (metaType === 'Initial') {
                        dataModel.stateMachine.initialState = self.core.getPath(children[i]);
                    } else if (metaType === 'End') {
                        dataModel.stateMachine.finalStates.push(self.core.getPath(children[i]));
                    }
                }
            }

            Q.all(statePromises)
                .then(function (statesData) {
                    dataModel.stateMachine.states = statesData;
                    deferred.resolve(dataModel);
                })
                .catch(deferred.reject);
        });

        return deferred.promise;
    };

    FSMCodeGenerator.prototype.getStateData = function(stateNode) {
        var self = this,
            deferred = new Q.defer(),
            stateData = {
                id: self.core.getPath(stateNode),
                name: self.core.getAttribute(stateNode, 'name'),
                transitions: [
                    // event: <string>
                    // targetId: <nodePathStr>
                ]
            },
            error,
            counter;

        function atDestinationState(connection) {

            return function (err, dstState) {
                if (err) {
                    error = new Error(err);
                } else {
                    stateData.transitions.push({
                        event: self.core.getAttribute(connection, 'event'),
                        targetId: self.core.getPath(dstState),
                        targetName: self.core.getAttribute(dstState, 'name'),
                    });
                }

                counter -= 1;
                if (counter === 0) {
                    if (error) {
                        deferred.reject(error);
                    } else {
                        deferred.resolve(stateData);
                    }
                }
            }
        }

        // Load all connections going out from the stateNode, i.e. has the stateNode as 'src'.
        self.core.loadCollection(stateNode, 'src', function (err, connections) {
            if (err) {
                deferred.reject(new Error(err));
                return;
            }
            var i;
            counter = connections.length;

            // For each connection load the destination state.
            for (i = 0; i < connections.length; i += 1) {
                self.core.loadPointer(connections[i], 'dst', atDestinationState(connections[i]));
            }

            // Make sure to resolve when there are no connections.
            if (connections.length === 0) {
                deferred.resolve(stateData);
            }
        });


        return deferred.promise;
    };

    FSMCodeGenerator.prototype.generateArtifact = function (dataModel) {
        var self = this,
            filesToAdd = {},
            deferred = new Q.defer(),
            jsonToXml = new Converter.JsonToXml(),
            artifact = self.blobClient.createArtifact('GeneratedFiles');

        filesToAdd['StateMachine.json'] = JSON.stringify(dataModel, null, 2);
        filesToAdd['metadata.json'] = JSON.stringify({
            projectId: self.projectId,
            commitHash: self.commitHash,
            branchName: self.branchName,
            timeStamp: (new Date()).toISOString(),
            pluginVersion: self.getVersion()
        }, null, 2);
        self.addXmlStateMachine(filesToAdd, dataModel);

        self.LANGUAGES.forEach(function (languageInfo) {
            self.addLanguageToFiles(filesToAdd, dataModel, languageInfo);
        });

        artifact.addFiles(filesToAdd, function (err) {
            if (err) {
                deferred.reject(new Error(err));
                return;
            }
            self.blobClient.saveAllArtifacts(function (err, hashes) {
                if (err) {
                    deferred.reject(new Error(err));
                    return;
                }

                self.result.addArtifact(hashes[0]);
                deferred.resolve();
            });
        });

        return deferred.promise;
    };

    /**
     * Appends the rendered templates for the language to filesToAdd.
     *
     * @param {object} filesToAdd
     * @param {object} dataModel
     * @param {object} languageInfo - see self.LANGUAGES
     */
    FSMCodeGenerator.prototype.addLanguageToFiles = function (filesToAdd, dataModel, languageInfo) {
        var genFileName = 'FSM-GeneratedCode/' + languageInfo.name + '/Program.' + languageInfo.fileExtension,
            batFileName = 'FSM-GeneratedCode/' + languageInfo.name + '/execute.bat';

        this.logger.debug(genFileName);
        this.logger.debug(batFileName);

        filesToAdd[genFileName] = ejs.render(TEMPLATES[languageInfo.generated], dataModel);
        filesToAdd[batFileName] = ejs.render(TEMPLATES[languageInfo.batFile], dataModel);

        //TODO Add the static files too.
        this.logger.info('Generated files for', languageInfo.name);

    };

    FSMCodeGenerator.prototype.addXmlStateMachine = function (filesToAdd, dataModel) {
        var self = this,
            taggedDataModel = {
                stateMachine: {
                    '@name': dataModel.stateMachine.name,
                    '@initialState': dataModel.stateMachine.initialState,
                    '@finalStates': dataModel.stateMachine.finalStates.join(' '),
                    state: []
                }
            },
            jsonToXml = new Converter.JsonToXml();

        dataModel.stateMachine.states.forEach(function (state) {
            var taggedState = {
                '@id': state.id,
                '@name': state.name,
                transition: []
            };
            state.transitions.forEach(function (transition) {
                taggedState.transition.push({
                    '@event': transition.event,
                    '@targetId': transition.targetId,
                    '@targetName': transition.targetName
                });
            });
            taggedDataModel.stateMachine.state.push(taggedState);
        });

        filesToAdd['StateMachine.xml'] = jsonToXml.convertToString(taggedDataModel);
    };

    return FSMCodeGenerator;
});