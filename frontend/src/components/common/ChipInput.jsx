import { useState, useEffect } from 'react'
import { Autocomplete, TextField, Chip, createFilterOptions } from '@mui/material'
import { apiFetch } from '../../api'

const filter = createFilterOptions()

export default function ChipInput({
  label,
  placeholder,
  value = [],
  onChange,
  fetchUrl,
  chipColor = 'rgba(99, 102, 241, 0.2)',
  chipTextColor = '#a5b4fc',
  size = 'small',
  sx = {},
}) {
  const [options, setOptions] = useState([])

  useEffect(() => {
    if (!fetchUrl) return
    apiFetch(`${fetchUrl}?per_page=100`)
      .then(res => res.json())
      .then(data => setOptions(data.items?.map(i => i.name) || []))
      .catch(() => {})
  }, [fetchUrl])

  return (
    <Autocomplete
      multiple
      freeSolo
      size={size}
      options={options}
      value={value}
      onChange={(e, newValue) => {
        const cleaned = newValue.map(v =>
          typeof v === 'string' && v.startsWith('+ Create "') && v.endsWith('"')
            ? v.replace(/^\+ Create "(.+)"$/, '$1')
            : v
        )
        onChange(cleaned)
      }}
      filterOptions={(opts, params) => {
        const filtered = filter(opts, params)
        const { inputValue } = params
        if (inputValue && !opts.some(o => o.toLowerCase() === inputValue.toLowerCase())) {
          filtered.push(`+ Create "${inputValue}"`)
        }
        return filtered
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            size="small"
            key={option}
            label={option}
            {...getTagProps({ index })}
            sx={{ borderRadius: '6px', bgcolor: chipColor, color: chipTextColor, fontWeight: 600, fontSize: '0.72rem' }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField {...params} size={size} label={label} placeholder={placeholder}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' }, ...sx }}
        />
      )}
      sx={{ '& .MuiAutocomplete-tag': { overflow: 'hidden' } }}
    />
  )
}
