/*
For numerical fields, this widget allows users to add a range query (e.g. "23 TO 57", etc.) on the field to the overall Solr query by either moving 2
sliders on superimposed HTML 5 range input elements, or by directly entering (into input text boxes) the left and right range values.

Configuration example:

	Manager.addWidget(new AjaxSolr.RangeWidget({
		                                    id: range_fields[i], //Same as for TagcloudWidget.js
			                            target: '#' + range_fields[i], //Same as for TagcloudWidget.js
			                            field: range_fields[i] //Same as for TagcloudWidget.js
                                                  }));

Notes:

Fields that this widget is used for should be numerical fields. Also, you will need to add statistics params for Solr requests, like this
(e.g. in reuters.js):

    ...
    ...
    Manager.init();
    Manager.store.addByValue('q', '*:*');
    var params = {
      stats: true,
      'stats.field': range_fields,
      facet: true,
      'facet.limit': 20,
      'f.topics.facet.limit': 50,
      'facet.field': fields,
      'facet.mincount': 1,
      'json.nl': 'map'
    };
    for (var name in params) {
      Manager.store.addByValue(name, params[name]);
    }
    ...
    ...

The widget gets the max and min values for the field from the statistics section of the results.

Finally, you will need to include the associated css file RangeWidget.css, e.g. in your html file:
<link rel="stylesheet" href="css/RangeWidget.css">

 */

(function ($) {
	
    AjaxSolr.RangeWidget = AjaxSolr.AbstractFacetWidget.extend({

	  afterRequest: function () {

	    var self = this;

	    var the_field = self.field;

	    if (!(this.manager.store.find('fq', new RegExp('^' + the_field)))) { //reset
		self.minValue = '';
		self.maxValue = '';
	    }
		  
	    if (typeof AjaxSolr.RangeWidget.Rangewidgets == 'undefined') { AjaxSolr.RangeWidget.Rangewidgets = {}; }
	    AjaxSolr.RangeWidget.Rangewidgets[the_field] = self;

	    if (typeof self.minValue == 'undefined') {
		self.minValue = '';
	    }
	    if (typeof self.maxValue == 'undefined') {
		self.maxValue = '';
	    }
	    
	    $(this.target).empty();

	    if (typeof this.min == 'undefined') { //just want min for initial query of all docs
		this.min = this.manager.response.stats.stats_fields[the_field].min;
	    }
	    if (typeof this.max == 'undefined') { //just want max for initial query of all docs
		this.max = this.manager.response.stats.stats_fields[the_field].max;
	    }

	    $(this.target).append(this.template(the_field));
	   
	  },
	
	  template: function (name, container) {

	    var the_field = this.field;

	    var config_min = this.min;
	    var config_max = this.max;
	    var cur_chosen_min = this.minValue;
	    if ((typeof cur_chosen_min == 'undefined') || (/^\s*$/.test(cur_chosen_min))) { cur_chosen_min = config_min; }
	    var cur_chosen_max = this.maxValue;
	    if ((typeof cur_chosen_max == 'undefined') || (/^\s*$/.test(cur_chosen_max))) { cur_chosen_max = config_max; }


	    objVal = function(id,val) {

	      if ( $( '#' + id ).length ) {
		  if (typeof id != 'undefined') {
		      if (typeof val != 'undefined') {
			  $('#' + id).val(val);
			  return(val);
		      } else {
			  return($('#' + id).val());
		      }
		  }
	      }
	    };

	    sliderInput = function(the_field, isChange, displayElementStyle) {

	      var slider1Val = parseFloat(objVal(the_field + 'slider1'));
	      var slider2Val = parseFloat(objVal(the_field + 'slider2'));

	      var leftValue;
	      var rightValue;
	      if (slider1Val < slider2Val) {
		  leftValue = slider1Val; rightValue = slider2Val;
	      } else {
		  leftValue = slider2Val; rightValue = slider1Val;
	      }

	      $( "#" + the_field + "rangeValues").html(leftValue + " - " + rightValue);

	      if (typeof displayElementStyle != 'undefined') {
		  $( "#" + the_field + "rangeValues" ).css( "display", displayElementStyle )
	      }

	      if (isChange) {
		  objVal(the_field + 'from',leftValue);
		  objVal(the_field + 'to',rightValue);
		  var self = AjaxSolr.RangeWidget.Rangewidgets[the_field];
		  self.minValue = leftValue;
		  self.maxValue = rightValue;
		  self.clear();
		  if ((leftValue == self.min) && (rightValue == self.max)) {
		      self.manager.store.removeByValue('fq' ,new RegExp('^' + the_field));
		  } else {
		      self.manager.store.addByValue('fq' , the_field + ':['+leftValue+' TO '+rightValue+']');
		  }
		  self.doRequest();
	      }

	    };

	    textBoxChange = function(the_field, bound_left, bound_right) {

	      var fromVal  = parseFloat(objVal(the_field + 'from'));
	      if (fromVal < bound_left) { fromVal = objVal(the_field + 'from',bound_left); }
	      if (fromVal > bound_right) { fromVal = objVal(the_field + 'from',bound_right); }
	      var toVal = parseFloat(objVal(the_field + 'to'));
	      if (toVal < bound_left) { toVal = objVal(the_field + 'to',bound_left); }
	      if (toVal > bound_right) { toVal = objVal(the_field + 'to',bound_right); }
	      if (fromVal > toVal) {
		  var tmp = fromVal; fromVal = toVal; toVal = tmp;
		  objVal(the_field + 'from',fromVal);
		  objVal(the_field + 'to',toVal)
	      }
	      objVal(the_field + 'slider1',fromVal);
	      objVal(the_field + 'slider2',toVal);
	      sliderInput(the_field,false,'none');
	      var self = AjaxSolr.RangeWidget.Rangewidgets[the_field];
	      self.minValue = fromVal;
	      self.maxValue = toVal;
	      self.clear();
	      if ((fromVal == self.min) && (toVal == self.max)) {
		  self.manager.store.removeByValue('fq' ,new RegExp('^' + the_field));
	      } else {
		  self.manager.store.addByValue('fq' , the_field + ':['+fromVal+' TO '+toVal+']');
	      }
	      self.doRequest();

	    };


	    var ret_val = '<section class="range-slider">' +
	             '<span id="' + the_field + 'rangeValues"></span>' +
	             '<input id=' + the_field + 'slider1 value="' + cur_chosen_min + '" min="' + config_min + '" max="' + config_max + '" type="range" oninput="sliderInput(\'' + the_field + '\',false,\'\');" onchange="sliderInput(\'' + the_field + '\',true,\'none\');">' +
	             '<input id=' + the_field + 'slider2 value="' + cur_chosen_max + '" min="' + config_min + '" max="' + config_max + '" type="range" oninput="sliderInput(\'' + the_field + '\',false,\'\');" onchange="sliderInput(\'' + the_field + '\',true,\'none\');">' +
                     '</section>' +
                     '<div style="width:200px">' +
	             //See here about float:left and float:right - http://stackoverflow.com/questions/727958/what-is-the-best-way-to-left-align-and-right-align-two-div-tags
	             '<div style="float:left;"><input type=text size=1 id=' + the_field + 'from value=' + cur_chosen_min + ' onchange="textBoxChange(\'' + the_field + '\',' + config_min + ',' + config_max + ');" /></div>' +
                     '<div style="float:right;"><input type=text size=1 id=' + the_field + 'to value=' + cur_chosen_max + ' onchange="textBoxChange(\'' + the_field + '\',' + config_min + ',' + config_max + ');" /></div>' +
	             '</div>';

	    return(ret_val);
	  }
	});

})(jQuery);