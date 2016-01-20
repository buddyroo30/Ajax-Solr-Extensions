(function ($) {

AjaxSolr.ResultWidget = AjaxSolr.AbstractWidget.extend({
  start: 0,

  beforeRequest: function () {
    $(this.target).html($('<img>').attr('src', 'images/ajax-loader.gif'));
  },

  facetLinks: function (facet_field, facet_values) {
    var links = [];
    if (facet_values) {
      for (var i = 0, l = facet_values.length; i < l; i++) {
        if (facet_values[i] !== undefined) {
          links.push(
            $('<a href="#"></a>')
            .text(facet_values[i])
            .click(this.facetHandler(facet_field, facet_values[i]))
          );
        }
        else {
          links.push('no items found in current selection');
        }
      }
    }
    return links;
  },

  facetHandler: function (facet_field, facet_value) {
    var self = this;
    return function () {
      self.manager.store.remove('fq');
      self.manager.store.addByValue('fq', facet_field + ':' + AjaxSolr.Parameter.escapeValue(facet_value));
      self.doRequest(0);
      return false;
    };
  },

  afterRequest: function () {
    $(this.target).empty();
    if (this.no_init_results) {
	if ((this.manager.store.get('q').value == '*:*') &&
	    (this.manager.store.values('fq').length <= 0)) {
	    return;
	} //Added so initial *:* query doesn't show results
    }
    for (var i = 0, l = this.manager.response.response.docs.length; i < l; i++) {
      var doc = this.manager.response.response.docs[i];
      $(this.target).append(this.template(doc,this.manager.response.highlighting));

      var items = [];
      items = items.concat(this.facetLinks('topics', doc.topics));
      items = items.concat(this.facetLinks('organisations', doc.organisations));
      items = items.concat(this.facetLinks('exchanges', doc.exchanges));

      var $links = $('#links_' + doc.id);
      $links.empty();
      for (var j = 0, m = items.length; j < m; j++) {
        $links.append($('<li></li>').append(items[j]));
      }
    }
  },

  getDocSnippets: function(highlighting, doc) {
	
	    var id_val = doc['id']; //Change if your documents have different ID field name
	    var cur_doc_highlighting = highlighting[id_val];
	    var all_snippets_arr = [];
	    if (typeof cur_doc_highlighting != 'undefined') {
		for (var snip_k in cur_doc_highlighting) {
		    var cur_snippets = cur_doc_highlighting[snip_k];
		    for (var snip_i=0; snip_i < cur_snippets.length; snip_i++) {
			var cur_snippet_txt = cur_snippets[snip_i];
			all_snippets_arr.push(cur_snippet_txt);
		    }
		}
	    }
	    var cur_doc_snippets_txt = '...' + all_snippets_arr.join('...') + '...';
	    return(cur_doc_snippets_txt);
  },

  template: function (doc,highlighting) {
    var snippet = '';
    var cur_doc_highlighting_txt;
    if (this.highlighting && highlighting) {
	cur_doc_highlighting_txt = this.getDocSnippets(highlighting,doc);
    }
    if (!(this.isBlank(cur_doc_highlighting_txt) || /^\s*\.*\s*$/.test(cur_doc_highlighting_txt))) {
      snippet += doc.dateline + cur_doc_highlighting_txt;
      snippet += '<br><span style="display:none;"><br><b>FULL DESCRIPTION</b>:' + doc.text;
      snippet += '</span> <a href="#" class="more">more</a>';
    } else if (doc.text.length > 300) {
      snippet += doc.dateline + ' ' + doc.text.substring(0, 300);
      snippet += '<span style="display:none;">' + doc.text.substring(300);
      snippet += '</span> <a href="#" class="more">more</a>';
    }
    else {
      snippet += doc.dateline + ' ' + doc.text;
    }

    var output = '<div><h2>' + doc.title + '</h2>';
    output += '<p id="links_' + doc.id + '" class="links"></p>';
    output += '<p>' + snippet + '</p></div>';
    return output;
  },

  isBlank: function(str) {
    return (!str || /^\s*$/.test(str));
  },


  init: function () {
    $(document).on('click', 'a.more', function () {
      var $this = $(this),
          span = $this.parent().find('span');

      if (span.is(':visible')) {
        span.hide();
        $this.text('more');
      }
      else {
        span.show();
        $this.text('less');
      }

      return false;
    });
  }
});

})(jQuery);