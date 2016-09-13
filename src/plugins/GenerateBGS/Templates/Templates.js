/* Generated file based on ejs templates */
define([], function() {
    return {
    "script.bgs.ejs": "import \"constants.bgs\"\nimport \"globals.bgs\"\n# Import user libraries here (if any)\n<%\nif (model.Library_list) {\n  model.Library_list.map(function(library) {\n-%>\nimport \"<%- library.name %>.bgs\"\n<%\n  });\n}\n-%>\n\n# The timer handles all the state function code and state transition\n#  code\nevent hardware_soft_timer(handle)\n  changeState = 0\n  # Generated code to execute state transitions and state functions\n<%\nif (model.State_list) {\n  model.State_list.map(function(state) {\n-%>\n<%- state.timerFunc %>\n<%\n  });\n}\n-%>\nend\n\n# The interrupt routine handles all conversion from input interrupts\n#  to state variables for state transitions\nevent hardware_io_port_status(timestamp, port, irq, state_io)\n  # user code to handle the interrupts and convert them to state\n  #  variables\n<%- model.hardware_io_port_status %>\n\n  changeState = 0\n  # Generated code to perform needed state transitions\n<%\nif (model.State_list) {\n  model.State_list.map(function(state) {\n-%>\n<%- state.irqFunc %>\n<%\n  });\n}\n-%>\nend\n<%\nif (model.Event_list) {\n  model.Event_list.map(function(event) {\n-%>\n\n<%- event.function %>\n<%\n  });\n}\n-%>\n"
}});