const { join } = require('path');
const { shell } = require('electron');
const { React, getModule, contextMenu, i18n: { Messages } } = require('powercord/webpack');
const { Button, Tooltip, ContextMenu, Divider, Icons: { Overflow } } = require('powercord/components');
const { TextInput, Category, ButtonItem } = require('powercord/components/settings');

class Base extends React.Component {
  constructor () {
    super();
    this.state = {
      key: `${this.constructor.name.toUpperCase()}`,
      PCPluginsCategoryOpen: false,
      search: ''
    };
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
          : this.renderItems(items)}
      </div>
    );
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
      </div>
    );
  }

  renderItem () {
    return null;
  }

  renderItems (items) {
    const [ PC, noPC ] = this._partition(items, p => p.entityID.startsWith('pc-'));
    return <>
      {this.renderPCCategory(PC)}
      {noPC.map(item => this.renderItem(item))}
    </>;
  }

  renderPCCategory (items) {
    return (
      <Category
        name={Messages.POWERCORD_PLUGINS_CORE}
        description={Messages.POWERCORD_SETTINGS_ADVANCED_DESC}
        opened={this.state.PCPluginsCategoryOpen}
        onChange={() =>
          this.setState({
            PCPluginsCategoryOpen: !this.state.PCPluginsCategoryOpen
          })
        }
      >
        {this.renderEnableAllButton(items)}
        {items.map(item => this.renderItem(item))}
      </Category>
    );
  }

  renderEnableAllButton (items) {
    return (
      <ButtonItem
        button={Messages.POWERCORD_PLUGINS_ENABLE_ALL_GO}
        onClick={async () => {
          await items.forEach(p => this._toggle(p.entityID, true));
          this.forceUpdate();
        }}
      >{Messages.POWERCORD_PLUGINS_ENABLE_ALL}
      </ButtonItem>
    );
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

  _sortItems (items) {
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

  _partition (array, check) {
    return array.reduce(([ pass, fail ], elem) => {
      if (check(elem)) {
        return [ [ ...pass, elem ], fail ];
      }
      return [ pass, [ ...fail, elem ] ];
    }, [ [], [] ]);
  }
}

module.exports = Base;
