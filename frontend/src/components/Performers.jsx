import EntityListPage from './common/EntityListPage'

export default function Performers({ setActivePage }) {
  return (
    <EntityListPage
      title="Performers"
      fetchUrl="/performers"
      filterField="performers"
      overviewDescription="Browse all performers across your library. Click a performer to filter the library by that name."
      emptyMessage="No performers found in your library."
      onNavigate={(name) => {
        if (setActivePage) {
          setActivePage(name)
        }
        window.location.hash = `#library?performers=${encodeURIComponent(name)}`
      }}
    />
  )
}
