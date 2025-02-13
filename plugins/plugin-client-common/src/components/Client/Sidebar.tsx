/*
 * Copyright 2022 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react'
import { encodeComponent, pexecInCurrentTab } from '@kui-shell/core/mdist/api/Exec'
import { PageSidebar, PageSidebarProps } from '@patternfly/react-core/dist/esm/components/Page/PageSidebar'

import CommonProps from './props/Common'
import BrandingProps from './props/Branding'
import GuidebookProps, { isGuidebook, Guidebook, isMenu, MenuItem } from './props/Guidebooks'

import '../../../web/scss/components/Sidebar/_index.scss'

const Nav = React.lazy(() =>
  import('@patternfly/react-core/dist/esm/components/Nav/Nav').then(_ => ({ default: _.Nav }))
)
const NavItem = React.lazy(() =>
  import('@patternfly/react-core/dist/esm/components/Nav/NavItem').then(_ => ({ default: _.NavItem }))
)
const NavList = React.lazy(() =>
  import('@patternfly/react-core/dist/esm/components/Nav/NavList').then(_ => ({ default: _.NavList }))
)
const NavExpandable = React.lazy(() =>
  import('@patternfly/react-core/dist/esm/components/Nav/NavExpandable').then(_ => ({ default: _.NavExpandable }))
)

type Props = Pick<CommonProps, 'noTopTabs'> &
  BrandingProps &
  GuidebookProps & {
    /** unfurled? */
    isOpen: boolean

    /** visually indicate which nav item is active? */
    indicateActiveItem?: boolean

    /** toggle open state */
    toggleOpen(): void
  }

type State = Pick<PageSidebarProps, 'nav'> & {
  /** in noTopTabs mode, we indicate selected guidebook in the NavItem below */
  currentGuidebook?: string
}

export default class Sidebar extends React.PureComponent<Props, State> {
  private readonly cleaners: (() => void)[] = []

  public constructor(props: Props) {
    super(props)
    this.state = {
      nav: this.nav() // pre-render to help with persistence of isExpanded state
    }
  }

  private get currentGuidebook() {
    return this.state ? this.state.currentGuidebook : undefined
  }

  public componentWillUnmount() {
    this.cleaners.forEach(_ => _())
  }

  /** e.g. product version */
  private footer() {
    return (
      this.props.productName &&
      this.props.version && (
        <div className="kui--tab-container-sidebar-other flex-layout">
          <span className="inline-flex flex-fill flex-align-end semi-bold">v{this.props.version}</span>
        </div>
      )
    )
  }

  /** User has clicked to select a given Guidebook */
  private onSelect(_: Guidebook) {
    const quiet = !this.props.noTopTabs

    // if the notebooks.json entry has a `play` field, then pass this
    // through the commentary delegate, which just wraps the `play`
    // command into a full-screen/maximized in-place replay of the
    // filepath
    const cmd = _.play ? `commentary delegate '${_.play}'` : this.props.guidebooksCommand || 'replay'
    pexecInCurrentTab(`${cmd} ${encodeComponent(_.filepath)}`, undefined, quiet)

    this.setState({
      currentGuidebook: _.notebook,
      nav: this.nav(_.notebook) // pre-render to help with persistence of isExpanded state
    })

    // we may want to toggle the sidebar closed, after the user has
    // clicked to open a guidebook; the enclosing component can
    // dictate this behavior, our job is only to notify that component
    this.props.toggleOpen()
  }

  /** Render the menu structure of the sidebar */
  private menu(currentGuidebook = this.currentGuidebook) {
    // helps deal with isActive; if we don't have a currentGuidebook,
    // use the first one (for now)
    let first = !currentGuidebook

    const renderItem = (_: MenuItem, idx: number) => {
      const thisIsTheFirstNavItem = isGuidebook(_) && first
      if (thisIsTheFirstNavItem) {
        first = false
      }

      return isGuidebook(_) ? (
        <NavItem
          key={idx}
          data-title={_.notebook}
          className="kui--sidebar-nav-item"
          onClick={this.onSelect.bind(this, _)}
          isActive={this.props.indicateActiveItem && (_.notebook === currentGuidebook || thisIsTheFirstNavItem)}
        >
          {_.notebook}
        </NavItem>
      ) : isMenu(_) ? (
        <NavExpandable
          key={idx}
          title={_.label}
          data-title={_.label}
          className="kui--sidebar-nav-menu"
          isExpanded={_.expanded !== false}
        >
          {_.submenu.map(renderItem)}
        </NavExpandable>
      ) : undefined
    }

    return (
      Array.isArray(this.props.guidebooks) && (
        <React.Suspense fallback={<div />}>
          <Nav className="kui--tab-container-sidebar-nav">
            <NavList>{this.props.guidebooks.map(renderItem)}</NavList>
          </Nav>
        </React.Suspense>
      )
    )
  }

  /**
   * This is the entirety of the contents of the sidebar. The method
   * is named `nav` because that is what the PatternFly component
   * calls the corresponding property.
   */
  private nav(currentGuidebook = this.currentGuidebook) {
    return (
      Array.isArray(this.props.guidebooks) && (
        <React.Fragment>
          {this.menu(currentGuidebook)}
          {this.footer()}
        </React.Fragment>
      )
    )
  }

  public render() {
    return (
      this.state.nav && (
        <PageSidebar nav={this.state.nav} isNavOpen={this.props.isOpen} className="kui--tab-container-sidebar" />
      )
    )
  }
}
