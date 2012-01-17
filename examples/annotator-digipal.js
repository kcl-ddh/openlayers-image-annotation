/**
 * Annotator implementation for DigiPal.
 * 
 * @param imageUrl
 *            URL of the image to annotate.
 * @param imageWidth
 *            Width of the image to annotate.
 * @param imageHeight
 *            Height of the image to annotate.
 */
function DigipalAnnotator(imageUrl, imageWidth, imageHeight) {
	Annotator.call(this, imageUrl, imageWidth, imageHeight);

	this.annotations = null;
}

// inherits from Annotator
DigipalAnnotator.prototype = new Annotator();

// corrects the contructor pointer because it points to Annotator
DigipalAnnotator.prototype.constructor = DigipalAnnotator;

/**
 * Shows the annotation details for the given feature.
 * 
 * @param feature
 *            The feature to display the annotation.
 */
DigipalAnnotator.prototype.showAnnotation = function(feature) {
	if (this.annotations) {
		var annotation = null;

		for ( var idx in this.annotations) {
			annotation = this.annotations[idx];

			if (getValueFromObjField(annotation.fields, 'vector_id') == feature.id) {
				break;
			} else {
				annotation = null;
			}
		}

		if (annotation) {
			$('#id_hand').val(annotation.fields['hand']);
			$('#id_status')
					.val(getKeyFromObjField(annotation.fields, 'status'));
			$('#id_letter')
					.val(getKeyFromObjField(annotation.fields, 'letter'));
			$('#id_display_note').val(
					getValueFromObjField(annotation.fields, 'display_note'));
			$('#id_internal_note').val(
					getValueFromObjField(annotation.fields, 'internal_note'));

			updateSelectOptions('id_minim', annotation.fields['minim']);
			updateSelectOptions('id_pen_angle', annotation.fields['pen_angle']);
			updateSelectOptions('id_ascender', annotation.fields['ascender']);
			updateSelectOptions('id_descender', annotation.fields['descender']);
			updateSelectOptions('id_aspect', annotation.fields['aspect']);

			// forces the change of the letter to update the list of features
			updateOptionsForLetter($('#id_letter option:selected').val(),
					annotation);
		}
	}
}

/**
 * Some fields are stored in the database as key:value. This function returns
 * the key.
 */
function getKeyFromObjField(obj, field) {
	var key = null;

	if (obj[field]) {
		key = obj[field];
		key = key.substring(0, key.indexOf(':'));
	}

	return key;
}
/**
 * This function returns the value.
 */
function getValueFromObjField(obj, field) {
	var value = null;

	if (obj[field]) {
		value = obj[field];
		value = value.substring(value.indexOf(':') + 1);
	}

	return value;
}

/**
 * Updates the select element according to the given values.
 * 
 * @param elementId
 *            The id of select element to update.
 * @param values
 *            The values to update the element with.
 */
function updateSelectOptions(elementId, values) {
	$('#' + elementId + ' :selected').removeAttr('selected');

	var detail = '';

	for ( var idx in values) {
		var key = values[idx].substring(0, values[idx].indexOf(':'));
		var value = values[idx].substring(values[idx].indexOf(':') + 1);

		$('#' + elementId + ' option').each(function() {
			if ($(this).val() == key) {
				$(this).attr('selected', 'selected');

				detail += value + '; ';
			}
		});
	}

	$('#' + elementId).multiselect('refresh');

	if (detail) {
		$('#' + elementId + '_detail').text(detail);
	} else {
		$('#' + elementId + '_detail').text('-');
	}
}

/**
 * Updates the Feature select field according to the given letter and
 * annotation.
 * 
 * @param letterId
 *            The id of the letter.
 * @param annotation
 *            The annotation.
 */
function updateOptionsForLetter(letterId, annotation) {
	$.getJSON('letter/' + letterId + '/features/', function(data) {
		if (data.has_minim) {
			enableMultiSelect('id_minim');
		} else {
			disableMultiSelect('id_minim');
		}
		if (data.has_ascender) {
			enableMultiSelect('id_ascender');
		} else {
			disableMultiSelect('id_ascender');
		}
		if (data.has_descender) {
			enableMultiSelect('id_descender');
		} else {
			disableMultiSelect('id_descender');
		}

		$('#id_feature option').each(function() {
			$(this).remove();
		});

		$('#id_feature').multiselect('refresh');

		var features = data.features;

		$.each(features, function(idx) {
			var value = features[idx];

			$('#id_feature').append($('<option>', {
				value : idx
			}).text(value));
		});

		$('#id_feature').multiselect('refresh');

		if (annotation != null) {
			updateSelectOptions('id_feature', annotation.fields['feature']);
		}
	});
}

/**
 * Enables a multiselect element given its id.
 * 
 * @param elementId
 *            The id of the element to enable.
 */
function enableMultiSelect(elementId) {
	$('#' + elementId).removeAttr('disabled');
	$('#' + elementId).multiselect('enable');
}

/**
 * Disables a multiselect element given its id.
 * 
 * @param elementId
 *            The id of the element to disable.
 */
function disableMultiSelect(elementId) {
	$('#' + elementId + ' option').each(function() {
		$(this).removeAttr('selected');
	});
	$('#' + elementId).multiselect('refresh');
	$('#' + elementId).attr('disabled', 'disabled');
	$('#' + elementId).multiselect('disable');
}

/**
 * Deletes the annotation for the selected feature.
 * 
 * @param layer
 *            The feature's layer.
 * @param feature
 *            The feature to delete the annotation for.
 */
DigipalAnnotator.prototype.deleteAnnotation = function(layer, feature) {
	var _self = this;

	var msg = 'You are about to delete this annotation. It cannot be restored at a later time! Continue?';
	var doDelete = confirm(msg);

	if (doDelete && feature != null) {
		var featureId = feature.id;

		layer.destroyFeatures([ feature ]);

		$.ajax({
			url : 'delete/' + featureId + '/',
			data : '',
			error : function(xhr, textStatus, errorThrown) {
				alert('Error: ' + textStatus);
			},
			success : function(data) {
				if (data.success == false) {
					handleErrors(data);
				} else {
					updateStatus('Deleted annotation.');
					_self.loadAnnotations();
				}
			}
		});
	}
}

/**
 * Deletes the annotation for the feature with the given id.
 * 
 * @param id
 *            The feature id.
 */
function deleteAnnotationByFeatureId(id) {
	annotator.selectFeatureByIdAndCentre(id);
	annotator.deleteAnnotation(annotator.vectorLayer, annotator.vectorLayer.getFeatureById(id));
}

/**
 * Saves an annotation for the currently selected feature.
 */
DigipalAnnotator.prototype.saveAnnotation = function() {
	if (this.modifyFeature.feature) {
		this.modifyFeature.selectControl.unselectAll();
	}

	if (this.selectedFeature) {
		var geoJson = this.format.write(this.selectedFeature);
		var form = $('#frmAnnotation');

		save('save', this.selectedFeature, geoJson, form.serialize());

		this.loadAnnotations();
	} else {
		for ( var idx = 0; idx < this.vectorLayer.features.length; idx++) {
			var feature = this.vectorLayer.features[idx];
			var geoJson = this.format.write(feature);
			var form = $('#frmAnnotation');

			save('save_vector', feature, geoJson, form.serialize());
		}

		this.loadAnnotations();
		this.vectorLayer.redraw();
	}
}

/**
 * Executes an Ajax call to save a feature/annotation.
 * 
 * @param url
 *            The save url.
 * @param feature
 *            The feature.
 * @param geoJson
 *            The feature serialized as GEOJson.
 * @param data
 *            Additional data for the annotation.
 */
function save(url, feature, geoJson, data) {
	var id = feature.id;
	
	annotator.setSavedAttribute(feature, Annotator.SAVED, false);
	
	$.ajax({
		url : url + '/' + id + '/?geo_json=' + geoJson,
		data : data,
		error : function(xhr, textStatus, errorThrown) {
			alert('Error: ' + textStatus);
			annotator.setSavedAttribute(feature, Annotator.UNSAVED, false);
		},
		success : function(data) {
			if (data.success == false) {
				handleErrors(data);
			} else {
				updateStatus('Saved annotation.');
			}
		}
	});
}

/**
 * Displays an alert for each error in the data.
 * 
 * @param data
 *            Object with errors.
 */
function handleErrors(data) {
	for ( var e in data.errors) {
		alert(e + ': ' + data.errors[e]);
	}
}

/**
 * Updates the status message of the last operation.
 * 
 * @param msg
 *            Status message to display.
 */
function updateStatus(msg) {
	$('#status').text(msg);
}

/**
 * Loads existing vectors into the vectors layer.
 * 
 * @param layer
 *            The layer where the vectors will be rendered.
 */
DigipalAnnotator.prototype.loadVectors = function() {
	var map = this.map;
	var layer = this.vectorLayer;
	var format = this.format;

	$.getJSON('vectors/', function(data) {
		var features = [];

		$.each(data, function(id, vector) {
			var f = format.read(vector)[0];
			f.id = id;
			features.push(f);
		});

		// adds all the vectors to the vector layer
		layer.addFeatures(features);

		// zooms to the max extent of the map area
		map.zoomToMaxExtent();
	});
}

/**
 * Loads existing annotations.
 */
DigipalAnnotator.prototype.loadAnnotations = function() {
	var _self = this;
	var selectedFeature = this.selectedFeature;

	$.getJSON('annotations/', function(data) {
		_self.annotations = data;
		showAnnotationsOverview(data);

		if (selectedFeature) {
			_self.showAnnotation(selectedFeature);
		}
	});
}

/**
 * Displays annotations overview.
 * 
 * @param data
 *            The annotation data.
 */
function showAnnotationsOverview(data) {
	$('#overview').children().remove();

	$.each(data, function(idx) {
		var a = data[idx];
		var fid = a.fields.vector_id;
		fid = fid.substring(fid.indexOf(':') + 1);

		var dt = document.createElement('dt');
		dt.setAttribute('id', fid);
		var letter = getValueFromObjField(a.fields, 'letter');
		dt.innerHTML = (letter ? letter : '-') + ': ';
		var dd = document.createElement('dd');
		dd.innerHTML = '<a href="javascript: annotator.selectFeatureByIdAndCentre(\''
				+ fid
				+ '\');"'
				+ 'title="'
				+ fid
				+ '">'
				+ getValueFromObjField(a.fields, 'status')
				+ '</a>'
				+ '&nbsp;'
				+ '<a href="javascript: deleteAnnotationByFeatureId(\''
				+ fid + '\');">x</a>';

		$('#overview').append(dt);
		$('#overview').append(dd);
	});
}

/**
 * Turns on keyboard shortcuts for the controls.
 */
DigipalAnnotator.prototype.activateKeyboardShortcuts = function() {
	var _self = this;
	var activeControls = _self.map.getControlsBy('active', true);

	$(document).bind('keydown', 'ctrl+backspace', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.deleteFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+m', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.modifyFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+t', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.transformFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+d', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.duplicateFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+p', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.polygonFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+r', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.rectangleFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+f', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.selectFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+w', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.dragFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+z', function(event) {
		activeControls[activeControls.length - 1].deactivate();
		_self.zoomBoxFeature.activate();
		return false;
	});
	$(document).bind('keydown', 'ctrl+s', function(event) {
		_self.saveButton.trigger();
		return false;
	});
}