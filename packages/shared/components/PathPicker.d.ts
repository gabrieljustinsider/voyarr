import React from 'react'

export interface PathPickerProps {
  value?: string | string[]
  onChange: (value: string | string[]) => void
  label?: string
  helperText?: string
  purpose?: 'import' | 'open' | 'save' | 'export' | 'browse'
  mode?: 'folder' | 'file' | 'both'
  multiple?: boolean
  fullWidth?: boolean
  fetcher?: ((url: string, opts?: any) => Promise<Response>) | null
  browseEndpoint?: string
  autocompleteEndpoint?: string
  mkdirEndpoint?: string
  validateEndpoint?: string
  showVolumePills?: boolean
  showCapacityBadges?: boolean
  showPermissionBadge?: boolean
  enableHistoryNavigation?: boolean
  enableViewToggle?: boolean
  enableBookmarks?: boolean
}

declare const SharedPathPicker: React.FC<PathPickerProps>
export default SharedPathPicker
