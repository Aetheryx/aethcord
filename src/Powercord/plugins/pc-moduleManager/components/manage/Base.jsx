const { join } = require('path');
const { shell } = require('electron');
const { React, getModule, contextMenu, i18n: { Messages } } = require('powercord/webpack');
const { Button, Tooltip, ContextMenu, Divider, Icons: { Overflow } } = require('powercord/components');
const { TextInput, SelectInput } = require('powercord/components/settings');

class Base extends React.Component {
  constructor () {
    super();
    this.state = {
      key: `${this.constructor.name.toUpperCase()}`,
      search: '',
      show: null
    };
    this.options = [ { label: Messages.POWERCORD_SETTINGS_ENABLED,
      value: 'Enabled' }, { label: Messages.POWERCORD_SETTINGS_DISABLED,
      value: 'Disabled' } ];
  }

  render () {
    return (
      <div className='powercord-entities-manage powercord-text'>
        <div className='powercord-entities-manage-header'>
          {this.renderHeader()}
          {this.renderButtons()}
        </div>
        <Divider/>
        {this.renderBody()}
      </div>
    );
  }

  renderHeader () {
    return (
      <span>{Messages[`POWERCORD_${this.state.key}_INSTALLED`]}</span>
    );
  }

  renderButtons () {
    return (
      <div className='buttons'>
        {powercord.api.labs.isExperimentEnabled('pc-moduleManager-store')
          ? <Button onClick={() => this.goToStore()}>{Messages[`POWERCORD_${this.state.key}_EXPLORE`]}</Button>
          : <Tooltip text={Messages.COMING_SOON}>
            <Button disabled>{Messages[`POWERCORD_${this.state.key}_EXPLORE`]}</Button>
          </Tooltip>}
        <Overflow onClick={e => this.openOverflowMenu(e)} onContextMenu={e => this.openOverflowMenu(e)}/>
      </div>
    );
  }

  renderBody () {
    const items = this.getItems();
    return (
      <div className='powercord-entities-manage-items'>
        {this.renderSearch()}
        {items.length === 0
          ? <div className='empty'>
            <div className={getModule([ 'emptyStateImage', 'emptyStateSubtext' ], false).emptyStateImage}/>
            <p>{Messages.GIFT_CONFIRMATION_HEADER_FAIL}</p>
            <p>{Messages.SEARCH_NO_RESULTS}</p>
          </div>
          : items.map(item => this.renderItem(item))}
      </div>
    );
  }

  onSelectInputChange (val) {
    this.setState((prev) => ({ ...prev,
      show: val ? val.value : null }));
  }

  renderSearch () {
    return (
      <div className='powercord-entities-manage-search'>
        <TextInput
          value={this.state.search}
          onChange={search => this.setState({ search })}
          placeholder={Messages.POWERCORD_PRODUCT_LOOKING}
        >
          {Messages[`POWERCORD_${this.state.key}_SEARCH`]}
        </TextInput>

        <SelectInput
          value={this.state.show}
          onChange={(val) => this.onSelectInputChange(val)}
          options={this.options}
          searchable={false}
          clearable
        >
          {Messages.POWERCORD_SETTINGS_SHOW}
        </SelectInput>
      </div>
    );
  }

  renderItem () {
    return null;
  }

  getItems () {
    return [];
  }

  openOverflowMenu (e) {
    contextMenu.openContextMenu(e, () =>
      React.createElement(ContextMenu, {
        width: '50px',
        itemGroups: [ [
          {
            type: 'button',
            name: Messages[`POWERCORD_${this.state.key}_OPEN_FOLDER`],
            onClick: () => shell.openPath(join(__dirname, '..', '..', '..', '..', this.constructor.name.toLowerCase()))
          },
          {
            type: 'button',
            name: Messages[`POWERCORD_${this.state.key}_LOAD_MISSING`],
            onClick: () => this.fetchMissing()
          }
        ] ]
      })
    );
  }

  async goToStore () {
    const { popLayer } = await getModule([ 'popLayer' ]);
    const { transitionTo } = await getModule([ 'transitionTo' ]);
    popLayer();
    transitionTo(`/_powercord/store/${this.constructor.name.toLowerCase()}`);
  }

  fetchMissing () {
    throw new Error('Not implemented');
  }

  _sortItems (items, type) {
    const disabledPlugins = powercord.settings.get('disabledPlugins', []);
    const { disabledThemes } = powercord.styleManager;

    if (this.state.show === 'Enabled') {
      if (type === 'plugin') {
        items = items.filter(p => !disabledPlugins.includes(p.entityID));
      } else if (type === 'theme') {
        items = items.filter(p => !disabledThemes.includes(p.entityID));
      }
    } else if (this.state.show === 'Disabled') {
      if (type === 'plugin') {
        items = items.filter(p => disabledPlugins.includes(p.entityID));
      } else if (type === 'theme') {
        items = items.filter(p => disabledThemes.includes(p.entityID));
      }
    }

    if (this.state.search !== '') {
      const search = this.state.search.toLowerCase();
      items = items.filter(p =>
        p.manifest.name.toLowerCase().includes(search) ||
        p.manifest.author.toLowerCase().includes(search) ||
        p.manifest.description.toLowerCase().includes(search)
      );
    }

    return items.sort((a, b) => {
      const nameA = a.manifest.name.toLowerCase();
      const nameB = b.manifest.name.toLowerCase();

      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }

      return 0;
    });
  }
}

module.exports = Base;
