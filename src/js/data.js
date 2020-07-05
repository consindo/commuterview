import polylabel from 'polylabel'

const transformFilename = (name) =>
  name
    .trim()
    .toLowerCase()
    .split(' ')
    .join('-')
    .replace(/[()\/]/g, '')

// allows to get multiple locations, with a cache for speed
let locationCache = {}
export const getData = (locations) =>
  Promise.all(
    locations.map((location) => {
      const url = `/data/regions/${transformFilename(location)}.json`
      if (locationCache[url] === undefined) {
        return fetch(url)
          .then((res) => res.json())
          .then((data) => {
            locationCache[url] = data
            return data
          })
      } else {
        return Promise.resolve(locationCache[url])
      }
    })
  )

// finds the mid point of a geojson feature
export const getLocation = (features, name) => {
  let geometry
  try {
    geometry = features.find((i) => i.properties.name === name).geometry
  } catch (err) {
    console.error('Could not find', name, err)
    return { lat: 0, lng: 0 }
  }

  const center = polylabel(
    geometry.type === 'MultiPolygon'
      ? geometry.coordinates[0]
      : geometry.coordinates
  )
  return { lng: center[0], lat: center[1] }
}

// converts the data from the raw json
// does aggregation and latlng mapping
export const transformData = (features, dataSources, category) => {
  // sums the total values together
  let totalCount = 0
  const combinedSource = {}
  dataSources.forEach((source) => {
    // if the key doesn't exist, just skip iteration
    if (source[category] === undefined) return
    Object.keys(source[category]).forEach((location) => {
      if (combinedSource[location] === undefined) {
        combinedSource[location] = 0
      }
      combinedSource[location] += source[category][location]
      totalCount += source[category][location]
    })
  })

  return Object.keys(combinedSource).map((i) => {
    const coords = getLocation(features, i)
    return {
      key: i,
      value: combinedSource[i],
      percentage: combinedSource[i] / totalCount,
      x: coords.lng,
      y: coords.lat,
    }
  })
}

export const transformModeData = (dataSources, sourceKeys, category) => {
  const combinedSource = {}
  sourceKeys.forEach((key, index) => {
    // sets up combined object
    const keyArr = ['Total', key.split(':')[0], key]
    keyArr.forEach((k) => {
      if (combinedSource[k] === undefined) {
        combinedSource[k] = {}
      }
    })

    Object.keys(dataSources[index][category]).forEach((c) => {
      // don't care about the aggregated totals in the json
      if (c === 'Total') return
      keyArr.forEach((k) => {
        if (combinedSource[k][c] === undefined) {
          combinedSource[k][c] = 0
        }
        combinedSource[k][c] += dataSources[index][category][c]
      })
    })
  })
  return combinedSource
}
