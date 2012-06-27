/**
 * Class to control the Annotations with OpenLayers.
 * 
 * @param imageUrl
 *						URL of the image to annotate.
 * @param imageWidth
 *						Width of the image to annotate.
 * @param imageHeight
 *						Height of the image to annotate.
 * @param isZoomify
 *						Indicates if the imageUrl refers to a zoomify URL.
 */
function Annotator(imageUrl, imageWidth, imageHeight, isZoomify) {
	if (!imageUrl) {
			return;
	}

	// to make it accessible when 'this' loses scope
	var _self = this;

	this.imageUrl = imageUrl;
	this.imageWidth = imageWidth;
	this.imageHeight = imageHeight;

	var maxExtent = new OpenLayers.Bounds(0, 0, this.imageWidth,
			this.imageHeight);

	if (isZoomify) {
			// creates a new ZoomifyLayer for the image being annotated
			this.imageLayer = new OpenLayers.Layer.Zoomify('Zoomify', imageUrl,
					new OpenLayers.Size(this.imageWidth, this.imageHeight),
					{isBaseLayer : true});
	} else {
			// creates a new ImageLayer to display the image being annotated
			this.imageLayer = new OpenLayers.Layer.Image('Image', this.imageUrl,
					maxExtent, new OpenLayers.Size(this.imageWidth / 7,
							this.imageHeight / 7, {
								isBaseLayer : true,
								numZoomLevels : 3,
								ratio : 1.0
							}));
	}

	// creates a new OpenLayers map
	this.map = new OpenLayers.Map('map', {
		maxExtent : maxExtent,
		maxResolution: Math.pow(2, this.imageLayer.numberOfTiers - 1),
		numZoomLevels : this.imageLayer.numberOfTiers,
		projection : 'EPSG:3785',
		units : 'm'
	});

	//// adds the image layer to the map
	this.map.addLayer(this.imageLayer);

	// creates a StyleMap
	var styleMap = new OpenLayers.StyleMap();

	// creates a lookup table width different symbolizers for the styles
	var lookup = {
		0 : {
			fillColor : 'red'
		},
		1 : {
			fillColor : '#ee9900'
		}
	};

	// adds rules from the lookup table, with the keys mapped to the
	// 'state' property of the features, for the 'default' intent
	styleMap.addUniqueValueRules('default', Annotator.SAVED_ATTRIBUTE, lookup);

	// workaround to make the stylemap work with modify feature
	var rules = [ new OpenLayers.Rule({
		symbolizer : {},
		elseFilter : true
	}) ];
	styleMap.styles['default'].addRules(rules);

	// creates a new OpenLayers.Layer to draw and render vectors
	this.vectorLayer = new OpenLayers.Layer.Vector('Vector', {
		maxExtent : maxExtent,
		strategies : [ new OpenLayers.Strategy.Save() ],
		styleMap : styleMap
	});

	// turns events on the vector layer to detect when a feature is selected
	this.vectorLayer.events.on({
		'featureselected' : function(e) {
			_self.onFeatureSelect(e);
		},
		'featureunselected' : function(e) {
			_self.onFeatureUnSelect(e);
		},
		'featuremodified' : function(e) {
			_self.setSavedAttribute(e.feature, Annotator.UNSAVED, true);
			_self.selectFeatureById(e.feature.id);
		}
	});

	// adds the vector layer to the map
	this.map.addLayer(this.vectorLayer);

	// creates a new format to serialize/deserialize the vectors as GeoJSON
	this.format = new OpenLayers.Format.GeoJSON();

        this.createControls();
        this.toolbarPanel = this.createToolbar();

	// adds the toolbar panel to the map
	this.map.addControl(this.toolbarPanel);

	// loads existing vectors into the vector layer
	this.loadVectors();

	// loads existing annotations
	this.loadAnnotations();

	// automatically selects a feature after its inserted into the vector layer
	this.vectorLayer.preFeatureInsert = function(feature) {
		if (_self.getSavedAttribute(feature) != Annotator.SAVED) {
			_self.setSavedAttribute(feature, Annotator.UNSAVED, false);
		}
	}
	this.vectorLayer.onFeatureInsert = function(feature) {
		_self.selectFeatureById(feature.id);
		//_self.selectFeature.unselect(feature);
	}
}

Annotator.SAVED = 1;
Annotator.SAVED_ATTRIBUTE = 'saved';
Annotator.UNSAVED = 0;

/**
 * Creates Controls.
 */
Annotator.prototype.createControls = function() {
  this.deleteFeature = this.createDeleteFeature();
  this.modifyFeature = this.createModifyFeature();
  this.transformFeature = this.createTransformFeature();
  this.duplicateFeature = this.createDuplicateFeature();
  this.polygonFeature = this.createPolygonFeature();
  this.rectangleFeature = this.createRectangleFeature();
  this.selectFeature = this.createSelectFeature();
  this.dragFeature = this.createDragFeature();
  this.zoomBoxFeature = this.createZoomBoxFeature();
  this.saveButton = this.createSaveButton();
};

/**
 * Returns an OpenLayers Control to delete features.
 */
Annotator.prototype.createDeleteFeature = function() {
        var _self = this;
	DeleteFeature = OpenLayers.Class(OpenLayers.Control, {
		initialize : function(layer, options) {
			OpenLayers.Control.prototype.initialize.apply(this, [ options ]);
			this.layer = layer;
			this.handler = new OpenLayers.Handler.Feature(this, layer, {
				click : this.clickFeature
			});
		},
		clickFeature : function(feature) {
			_self.deleteAnnotation(this.layer, feature);
		},
		setMap : function(map) {
			this.handler.setMap(map);
			OpenLayers.Control.prototype.setMap.apply(this, arguments);
		},
		CLASS_NAME : 'OpenLayers.Control.DeleteFeature'
	});

	// creates a delete feature
	var deleteFeature = new DeleteFeature(this.vectorLayer, {
		displayClass : 'olControlDeleteFeature',
		title : 'Delete'
	});
        return deleteFeature;
};

/**
 * Returns an OpenLayers Control to modify features.
 */
Annotator.prototype.createModifyFeature = function() {
	var modifyFeature = new OpenLayers.Control.ModifyFeature(this.vectorLayer,
			{
				mode : OpenLayers.Control.ModifyFeature.RESHAPE
						| OpenLayers.Control.ModifyFeature.DRAG,
				displayClass : 'olControlModifyFeature',
				title : 'Modify'
			});
        return modifyFeature;
};

/**
 * Returns an OpenLayers Control to transform a feature. 
 */
Annotator.prototype.createTransformFeature = function() {
        var _self = this;
	var transformFeature = new TransformFeature(this.vectorLayer, {
		renderIntent : 'transform',
		irregular : true,
		displayClass : 'olControlTransformFeature',
		title : 'Transform'
	});
	transformFeature.events.on({
		'transformcomplete' : function(e) {
			_self.setSavedAttribute(e.feature, Annotator.UNSAVED, true);
			_self.selectFeatureById(e.feature.id);
		}
	});
        return transformFeature;
};

/**
 * Returns an OpenLayers Control to duplicate a feature.
 */
Annotator.prototype.createDuplicateFeature = function() {
	var duplicateFeature = new DuplicateFeature(this.vectorLayer, {
		displayClass : 'olControlDuplicateFeature',
		title : 'Duplicate'
	});
        return duplicateFeature;
};

/**
 * Returns an OpenLayers Control to create a polygon feature.
 */
Annotator.prototype.createPolygonFeature = function() {
	var polygonFeature = new OpenLayers.Control.DrawFeature(this.vectorLayer,
			OpenLayers.Handler.Polygon, {
				displayClass : 'olControlDrawFeaturePath',
				title : 'Draw Polygon'
			});
        return polygonFeature;
};

/**
 * Returns an OpenLayers Control to create a rectangle feature.
 */
Annotator.prototype.createRectangleFeature = function() {
	var rectangleFeature = new OpenLayers.Control.DrawFeature(
			this.vectorLayer, OpenLayers.Handler.RegularPolygon, {
				displayClass : 'olControlDrawFeaturePolygon',
				handlerOptions : {
					sides : 4,
					irregular : true
				},
				title : 'Draw Rectangle'
			});
        return rectangleFeature;
};

/**
 * Returns an OpenLayers Control to select a feature.
 */
Annotator.prototype.createSelectFeature = function() {
	var selectFeature = new OpenLayers.Control.SelectFeature(this.vectorLayer,
			{
				displayClass : 'olControlDragFeature',
				title : 'Select',
				clickout : true,
				toggle : false,
				multiple : false,
				hover : false,
				box : false
			});
        return selectFeature;
};

/**
 * Returns an OpenLayers Control to drag a feature.
 */
Annotator.prototype.createDragFeature = function() {
        var _self = this;
	var dragFeature = new OpenLayers.Control.DragFeature(this.vectorLayer, {
		displayClass : 'olControlSelectFeature',
		title : 'Drag'
	});
	dragFeature.onComplete = function(feature, pixel) {
		_self.setSavedAttribute(feature, Annotator.UNSAVED, true);
	};
        return dragFeature;
};

/**
 * Returns an OpenLayers Control zoom box.
 */
Annotator.prototype.createZoomBoxFeature = function() {
	var zoomBoxFeature = new OpenLayers.Control.ZoomBox({
		alwaysZoom : true,
		displayClass : 'olControlZoomBox'
	});
        return zoomBoxFeature;
};

/**
 * Returns an OpenLayers Control save button.
 */
Annotator.prototype.createSaveButton = function() {
        var _self = this;
	var saveButton = new OpenLayers.Control.Button({
		title : 'Save',
		trigger : function() {
			_self.saveAnnotation();
		},
		displayClass : 'olControlSaveFeatures'
	});
        return saveButton;
};

/**
 * Creates, populates and returns a toolbar.
 */
Annotator.prototype.createToolbar = function() {
	var toolbarPanel = new OpenLayers.Control.Panel({
		allowDepress : true,
		type : OpenLayers.Control.TYPE_TOGGLE,
		displayClass : 'olControlEditingToolbar'
	});
	// adds all the control features to the toolbar panel
	toolbarPanel.addControls([ this.deleteFeature, this.modifyFeature,
			this.transformFeature, this.duplicateFeature, this.polygonFeature,
			this.rectangleFeature, this.selectFeature, this.dragFeature,
			this.zoomBoxFeature, this.saveButton ]);

	// sets the default control to be the drag feature
	toolbarPanel.defaultControl = this.dragFeature;
        return toolbarPanel;
};

/**
 * Function that is called after a feature is selected.
 *
 * @param event
 *						The select event.
 */
Annotator.prototype.onFeatureSelect = function(event) {
	this.selectedFeature = event.feature;
	this.showAnnotation(event.feature);
}

/**
 * Function that is called after a feature is unselected.
 * 
 * @param event
 *						The unselect event.
 */
Annotator.prototype.onFeatureUnSelect = function(event) {
	this.selectedFeature = null;
}

/**
 * Shows the annotation details for the given feature.
 * 
 * @param feature
 *						The feature to display the annotation.
 */
Annotator.prototype.showAnnotation = function(feature) {
}

/**
 * Deletes the annotation for the selected feature.
 * 
 * @abstract
 * @param layer
 *						The feature's layer.
 * @param feature
 *						The feature to delete the annotation for.
 */
Annotator.prototype.deleteAnnotation = function(layer, feature) {
}

/**
 * Saves the selected feature annotation.
 * 
 * @abstract
 */
Annotator.prototype.saveAnnotation = function() {
}

/**
 * Loads existing vectors into a layer.
 * 
 * @abstract
 */
Annotator.prototype.loadVectors = function() {
}

/**
 * Loads existing annotations.
 * 
 * @abstract
 */
Annotator.prototype.loadAnnotations = function() {
}

/**
 * Turns on keyboard shortcuts for the controls.
 */
Annotator.prototype.activateKeyboardShortcuts = function(event) {
}

/**
 * Selects a feature by ID.
 * 
 * @param featureId
 *						The id of the feature to select.
 */
Annotator.prototype.selectFeatureById = function(featureId) {
	var feature = this.vectorLayer.getFeatureById(featureId);
	this.selectFeature.clickFeature(feature);
}

/**
 * Selects a feature by ID and centres on the feature.
 * 
 * @param featureId
 *						The id of the feature to select.
 */
Annotator.prototype.selectFeatureByIdAndCentre = function(featureId) {
	var feature = this.vectorLayer.getFeatureById(featureId);
	this.selectFeature.clickFeature(feature);
	this.map.setCenter(feature.geometry.getBounds().getCenterLonLat());
}

/**
 * Selects a feature by ID and zooms to the feature extent.
 * 
 * @param featureId
 *						The id of the feature to select.
 */
Annotator.prototype.selectFeatureByIdAndZoom = function(featureId) {
	var feature = this.vectorLayer.getFeatureById(featureId);
	this.selectFeature.clickFeature(feature);
	this.map.zoomToExtent(feature.geometry.getBounds());
}

/**
 * Returns the saved attribute for the given feature.
 * 
 * @param feature
 *						The value of the saved attribute.
 */
Annotator.prototype.getSavedAttribute = function(feature) {
	var attribute = Annotator.SAVED_ATTRIBUTE;

	return feature.attributes['saved'];
}

/**
 * Sets the saved attribute of the feature to the given value. If redraw is true
 * the layer will redraw the feature.
 * 
 * @param feature
 *						The feature to update.
 * @param saved
 *						The value for the saved attribute.
 * @param redraw
 *						Whether the layer should redraw the feature.
 */
Annotator.prototype.setSavedAttribute = function(feature, saved, redraw) {
	var attribute = Annotator.SAVED_ATTRIBUTE;
	feature.attributes = {
		'saved' : saved
	};

	if (redraw) {
		this.vectorLayer.drawFeature(feature, 'default');
	}
}
