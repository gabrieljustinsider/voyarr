import EntityListPage from './common/EntityListPage'

export default function Tags({ setActivePage }) {
  return (
    <EntityListPage
      title="Tags"
      fetchUrl="/tags"
      filterField="tags"
      overviewDescription="Browse all tags across your library. Click a tag to filter the library by that tag."
      emptyMessage="No tags found in your library."
      onNavigate={(name) => {
        if (setActivePage) {
          setActivePage(name)
        }
        window.location.hash = `#library?tags=${encodeURIComponent(name)}`
      }}
    />
  )
}
