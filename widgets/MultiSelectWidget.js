/*
This is a useful alternative to Ajax-Solr's TagcloudWidget.js and enables faceted filtering similar to many popular e-commerce sites such as Amazon.com, Walmart.com, etc. (i.e. facet values in ordered lists selected by checking checkboxes). Whereas TagcloudWidget.js shows facet values as a tag cloud and users can select a single facet value (and only a single facet value) by clicking on it, MultiSelectWidget.js shows the top facet values in a list ordered by count with checkboxes that the user can check to choose facet values (and more than one facet value for a facet can be selected, resulting in an "OR" query for the selected values). In addition to showing the top (e.g. top 20) facet values and allowing them to be easily selected by checking a checkbox, it also has a Jquery UI autocomplete where the user can choose any facet value (JSONP queries to Solr are done based on the users typed text in the autocomplete). Finally, it also supports binned ranges for numerical values (e.g. "0 TO 24", "25 TO 49", etc.), allowing sorting of the facet values based on the ranges instead of the counts (which can be more intuitive).

Configuration example, showing all configuration fields:

Manager.addWidget(new AjaxSolr.MultiSelectWidget({
                                                  id: fields[i], //Same as for TagcloudWidget.js
			                          target: '#' + fields[i], //Same as for TagcloudWidget.js
			                          field: fields[i], //Same as for TagcloudWidget.js
			                          autocomplete_field: fields[i] + '_ci', //Name of Solr index field to use for autocomplete
			                          autocomplete_field_case: 'lower', //'lower' or 'upper'; must exactly match case if not defined
			                          max_show: 10, //maximum number of facet values to show before '+more' link
			                          max_facets: 20, //maximum number of facet values to show after '+more' clicked
			                          sort_type: 'count' //possible values: 'range', 'lex', 'count'
			                         }));

Notes:

This widget also allows users to search all possible facet values via a Jquery UI autocomplete. If a value for 'autocomplete_field' is given, that
field will be searched by the Jquery UI autocomplete (i.e. it will issue Solr JSONP requests against that field). This can simply be the same value
as specified for 'field', or a separate case-insensitive version of that field. 'autocomplete_field_case' should specify what the case of
'autocomplete_field' is ('lower' or 'upper'). If no value is specified for 'autocomplete_field', then the widget will simply fetch all values
of the facet field, and then filter them case-insensitively in JavaScript; this should be fine for facet fields with a small number of values, but
could be very slow for facet fields with many facet values, and 'autocomplete_field' should be specified in these cases.

The top facet values will be sorted based on the value specified for 'sort_type':

'range' will assume the facet values are ranges, e.g. like "0 TO 24", "25 TO 49", etc., and will sort them numerically based on the
left side of the range
'count' will sort them based on their count in the current result set (i.e. how many documents in the current result set have the facet value)
'lex' will sort them alphabetically
*/

(function ($) {

AjaxSolr.MultiSelectWidget = AjaxSolr.AbstractFacetWidget.extend({

  checkboxChange: function(facet) {
     var self = this;

     var innerCheckboxChange = function() {
	 return(self.updateQueryDoRequest(facet,this.checked));
     };
     return(innerCheckboxChange);
  },

  autocompleteSelect: function() {
     var self = this;

     var innerAutocompleteSelect = function(event, ui) {
	 return(self.updateQueryDoRequest(ui.item.value,true));
     };
     return(innerAutocompleteSelect);
  },

  autocompleteAjaxFunction: function() {
     var self = this;

     var autocompleteDoAjax = function(req,resp) {

       var autocompleteDoAjax_callback_gen = function(req,resp) {

          var autocompleteDoAjax_callback = function(data) {
	     var field_facet_counts = data.facet_counts.facet_fields[self.field];
	     var matches_arr = [];
	     var match_regex = new RegExp(req.term,"i");
	     $.map(field_facet_counts, function(v,i) { if (i.match(match_regex)) { matches_arr.push(i); }});
	     matches_arr.sort(function(a,b) { return(field_facet_counts[b] - field_facet_counts[a]); });
             resp(matches_arr);
          };

	  return(autocompleteDoAjax_callback);
       };

       var search_term = req.term;
       var search_string;
       if (typeof self.autocomplete_field == 'undefined') { //Just get all facets and filter & sort in Javascript
	   search_string = 'rows=0&facet=true&facet.limit=-1&q=*:*&facet.field=' + self.field + '&facet.mincount=1&facet.threads=-1&json.nl=map';
       } else { //have Solr do the filtering (but will still need to filter in JavaScript, for multi-valued fields),
	        //e.g. on a separate case-insensitive version of the field --- see here for how to set one up:
	        //http://stackoverflow.com/questions/2053214/how-to-create-a-case-insensitive-copy-of-a-string-field-in-solr
	   var search_query;
	   if (self.autocomplete_field_case == 'upper') {
	       search_query = self.autocomplete_field + ':*' + search_term.toUpperCase() + '*';
	   } else if (self.autocomplete_field_case == 'lower') {
	       search_query = self.autocomplete_field + ':*' + search_term.toLowerCase() + '*';
	   } else { //leave as-is
	       search_query = self.autocomplete_field + ':*' + search_term + '*';
	   }
	   search_string = 'rows=0&facet=true&facet.limit=-1&q=' + search_query + '&facet.field=' + self.field + '&facet.mincount=1&facet.threads=-1&json.nl=map';
       }
       self.manager.executeRequest('select',search_string,autocompleteDoAjax_callback_gen(req,resp));
     };

     return(autocompleteDoAjax);
  },

  updateQueryDoRequest: function(facet, checked_flag) {

     var self = this;
     var check_state = self.check_state;
     if (typeof check_state == 'undefined') { self.check_state = {}; check_state = self.check_state; }
     if (checked_flag) { check_state[facet] = true; } else { delete check_state[facet]; }
     var checked_facets_arr = $.map(check_state, function(v,i) { return '"' + i + '"'; });
     self.manager.store.removeByValue('fq', new RegExp('^' + self.field));
     self.manager.store.removeByValue('facet.query', new RegExp('^' + self.field));
     if (checked_facets_arr.length > 0) {
	 var solr_query;
	 if (checked_facets_arr.length == 1) {
	     solr_query = self.field + ':' + checked_facets_arr[0];
	 } else {
	     solr_query = self.field + ':(' + checked_facets_arr.join(" OR ") + ')';
	 }
	 self.manager.store.addByValue('fq' , solr_query);
	 //Need to do explicit facet queries for user-chosen items (facet.field queries are not necessarily
	 //returning full results each request, only up to facet.limit, and so it is possible user-chosen ones
	 //wouldn't be among top returned values so need to explicitly get their counts)
	 for (var i=0; i < checked_facets_arr.length; i++) {
	     var cur_facet_query = self.field + ':' + checked_facets_arr[i];
	     self.manager.store.addByValue('facet.query' , cur_facet_query);
	 }
     }
     self.doRequest();
     return false;
   },

  toggleExtra: function(show_more_div_id) {
    var self = this;

    var clickFunc = function() {
      var el = document.getElementById(show_more_div_id);
      var el_txt = document.getElementById(show_more_div_id + '_txt');
      if (el && el_txt) {
	  if ( el.style.display != 'none' ) {
	      el.style.display = 'none';
	      el_txt.innerHTML = '+more';
	      self.display_style = 'none';
	  } else {
	      el.style.display = '';
	      el_txt.innerHTML = '-less';
	      self.display_style = '';
	  }
      }
      return false;
    };
    return(clickFunc);
  },

  sortFacets: function(objectedItems) {
    var sort_type = this.sort_type;
    if (typeof sort_type == 'undefined') { sort_type = 'count'; }
    if (sort_type == 'range') { //All the facet values should be like '20 TO 40', '50 TO 100', etc. or this sort type won't work
	objectedItems.sort(function (a, b) {
		if (typeof a.start == 'undefined') { return 1; }
		if (typeof b.start == 'undefined') { return -1; }
		return a.start < b.start ? -1 : 1;
	});
    } else if (sort_type == 'lex') { //sort facets alphabetically
        objectedItems.sort(function (a, b) {
          return a.facet < b.facet ? -1 : 1;
        });
    } else if (sort_type == 'count') { //the count in the current result set
        objectedItems.sort(function (a, b) {
          return b.count < a.count ? -1 : 1;
        });
    }
  },

  setRangeFacetStartEnd: function(facet, facet_rec) {
     var start_matches = facet.match(/^(\d+)/);
     var end_matches = facet.match(/(\d+)$/);
     if (start_matches && start_matches.length > 1) {
	 facet_rec.start = parseInt(start_matches[1]);
     }
     if (end_matches && end_matches.length > 1) {
	 facet_rec.end = parseInt(end_matches[1]);
     }
  },

  afterRequest: function () {

    var returned_facets = this.manager.response.facet_counts.facet_fields[this.field];

    if (returned_facets === undefined) {
	returned_facets = {};
    }

    if (!(this.manager.store.find('fq', new RegExp('^' + this.field)))) { //reset --> all checks off
	this.check_state = {};
    }

    if (typeof this.display_style == 'undefined') {
	this.display_style = 'none';
    }

    var checked_objectedItems = [];
    var unchecked_objectedItems = [];
    var cur_facets_hash = {};

    for (var facet in returned_facets) {
      var count = parseInt(returned_facets[facet]);
      var facet_rec = { facet: facet, count: count };
      if (this.sort_type == 'range') {
	  this.setRangeFacetStartEnd(facet, facet_rec);
      }

      if (this.check_state && this.check_state[facet]) {
	  checked_objectedItems.push(facet_rec);
      } else {
	  unchecked_objectedItems.push(facet_rec);
      }
      cur_facets_hash[facet] = facet_rec;
    }

    if (typeof this.check_state != 'undefined') {
	var num_checked_facets = Object.keys(this.check_state).length;
	if (num_checked_facets > checked_objectedItems.length) { //some checked items not present in current result set, need to add them from full result set
	    for (var cur_checked_facet in this.check_state) {
		if (!cur_facets_hash[cur_checked_facet]) { //Add a new record, getting count from facet query done for it)
		    var new_facet_rec = { facet: cur_checked_facet };
		    if (this.sort_type == 'range') {
			this.setRangeFacetStartEnd(facet, new_facet_rec);
		    }

		    new_facet_rec.count = parseInt(this.manager.response.facet_counts.facet_queries[this.field + ':"' + cur_checked_facet + '"']);
		    if (typeof new_facet_rec.count == 'undefined') { new_facet_rec.count = 0; } //if for some strange reason no facet query value...
		    checked_objectedItems.push(new_facet_rec);
		    cur_facets_hash[cur_checked_facet] = new_facet_rec;
		}
	    }
	}
    }

    this.sortFacets(checked_objectedItems);
    this.sortFacets(unchecked_objectedItems);

    var objectedItems = checked_objectedItems.concat(unchecked_objectedItems);

    if (typeof this.init_objectedItems == 'undefined') {
	//	$.extend(cur_facets_hash_copy, cur_facets_hash );
	var objectedItems_copy = JSON.parse(JSON.stringify(objectedItems));
	var cur_facets_hash_copy = JSON.parse(JSON.stringify(cur_facets_hash));
	this.init_objectedItems = objectedItems_copy;
	this.init_facets_hash = cur_facets_hash_copy;
    }

    if (typeof this.max_facets != 'undefined') {
	if (objectedItems.length < this.max_facets) {
	    var num_to_add_from_init = this.max_facets - objectedItems.length;
	    if (num_to_add_from_init > this.init_objectedItems.length) {
		num_to_add_from_init = this.init_objectedItems.length;
	    }
	    for (var i=0; i < this.init_objectedItems.length; i++) {
		if (!cur_facets_hash[this.init_objectedItems[i].facet]) {
		    objectedItems.push(this.init_objectedItems[i]);
		    if (--num_to_add_from_init <= 0) { break; }
		}
	    }
	} else if (objectedItems.length > this.max_facets) { //bug: if user checks a lot, some won't be shown; fixed below, but check it more
	    if (checked_objectedItems.length >= this.max_facets) {
		objectedItems = checked_objectedItems;
	    } else {
		objectedItems.length = this.max_facets;
	    }
	}
    } else {
	var num_to_add_from_init = this.init_objectedItems.length;
	for (var i=0; i < num_to_add_from_init; i++) {
	    if (!cur_facets_hash[this.init_objectedItems[i].facet]) {
		objectedItems.push(this.init_objectedItems[i]);
	    }
	}
    }

    var show_more_div_id = 'more_' + this.field;
    $(this.target).empty();
    var num_hidden = 0;
    for (var i = 0; i < objectedItems.length; i++) {
	//      if (typeof this.max_facets != 'undefined') {
	//	  if (i >= this.max_facets) { break; }
	//      }
      var facet = objectedItems[i].facet;
      var cur_facet_count = (typeof cur_facets_hash[facet] != 'undefined') ? cur_facets_hash[facet].count : 0;

      var checked_txt = '';
      if (this.check_state && this.check_state[facet]) {
	  checked_txt = ' checked=true';
      }
      if ((typeof this.max_show == 'undefined') ||
	  (i < this.max_show)) {
	  $(this.target).append(
	   $('<input type=checkbox id="' + this.field + '_' + facet + '_checkbox"' + checked_txt + '></input>')
	   .change(this.checkboxChange(facet))
	  );
	  $(this.target).append($('<span style="padding-left: 2px; font-size: small"></span>').text(facet));
	  if (cur_facet_count != 0) {
	      $(this.target).append($('<span style="font-size: x-small"></span>').text(' (' + cur_facet_count + ')'));
	  }
	  $(this.target).append($('<br>'));
      }

      if ((typeof this.max_show != 'undefined') && (i == (this.max_show - 1))) {
	  var display_style_txt = (this.display_style == 'none') ? ' style="display:none"' : '';
	  $(this.target).append('<div id="'+ show_more_div_id + '"' + display_style_txt + '></div>');
      }

      if ((typeof this.max_show != 'undefined') &&
	  (i >= this.max_show)) {

	  $('#' + show_more_div_id).append(
	   $('<input type=checkbox id="' + this.field + '_' + facet + '_checkbox"' + checked_txt + '></input>')
	   .change(this.checkboxChange(facet))
	  );
	  $('#' + show_more_div_id).append($('<span style="padding-left: 2px; font-size: small"></span>').text(facet));
	  if (cur_facet_count != 0) {
	      $('#' + show_more_div_id).append($('<span style="font-size: x-small"></span>').text(' (' + cur_facet_count + ')'));
	  }
	  $('#' + show_more_div_id).append($('<br>'));
	  num_hidden++;
      }

    }

    var ac_id = this.field + '_all_extra';
    if (num_hidden > 0) {
	$('#' + show_more_div_id).append('Or search: ');
	$('#' + show_more_div_id).append($('<input id="' + ac_id + '">'));
	var more_or_less_txt = (this.display_style == 'none') ? '+more' : '-less';
	$(this.target).append('<a id="' + show_more_div_id + '_txt" href="#">' + more_or_less_txt + '</a>');
	$('#' + show_more_div_id + '_txt').click(this.toggleExtra(show_more_div_id));
    } else {
	$(this.target).append('Or search: ');
	$(this.target).append($('<input id="' + ac_id + '">'));
    }
    $('#' + ac_id).autocomplete({
		                  source: this.autocompleteAjaxFunction(),
		                  minLength: 1,
		                  appendTo: this.target,
		                  select: this.autocompleteSelect()
		                });

  }
});

})(jQuery);
