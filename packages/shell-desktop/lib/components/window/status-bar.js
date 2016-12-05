import Ember from 'ember';
import layout from 'ember-shell/templates/desktop/window/status-bar';

export default Ember.Component.extend({
  layout,
  tagName: 'window-status-bar',
  classNames: ['flex-box']
});
