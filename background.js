const groupsSupported = () => !!chrome.tabGroups && !!chrome.tabs.group

const getData = (callback) => {
  let resData = {
    groupsArr: [],
    tabsArr: [],
    bookmarksFoldersArr: [],
    targetFolderId: '',
    rootPath: 'Groups',
    groupsSupported: groupsSupported(),
  }

  chrome.storage.local.get(['path']).then((result) => {
    if (result?.path) {
      resData.rootPath = result.path
    }
    if (!resData.groupsSupported) {
      chrome.bookmarks.search({ title: resData.rootPath }, (folder) => {
        if (folder.length > 0) {
          resData.targetFolderId = folder[0].id
          getBookmarks(resData, (res) => {
            resData = res
            callback(resData)
          })
        } else {
          chrome.bookmarks.create({ title: resData.rootPath }, (folder) => {
            resData.targetFolderId = folder.id
            getBookmarks(resData, (res) => {
              resData = res
              callback(resData)
            })
          })
        }
      })
      return
    }
    chrome.tabGroups.query({}, (groups) => {
      resData.groupsArr = groups
      chrome.tabs.query({}, (tabs) => {
        resData.tabsArr = tabs
        chrome.bookmarks.search({ title: resData.rootPath }, (folder) => {
          if (folder.length > 0) {
            resData.targetFolderId = folder[0].id
            getBookmarks(resData, (res) => {
              resData = res
              callback(resData)
            })
          } else {
            chrome.bookmarks.create({ title: resData.rootPath }, (folder) => {
              resData.targetFolderId = folder.id
              getBookmarks(resData, (res) => {
                resData = res
                callback(resData)
              })
            })
          }
        })
      })
    })
  })
}

const getBookmarks = (data, callback) => {
  chrome.bookmarks.getSubTree(data.targetFolderId, (bookmarks) => {
    if (bookmarks.length > 0) {
      data.bookmarksFoldersArr = bookmarks[0].children.filter(
        (folder) => !folder.url,
      )
      data.bookmarksFoldersArr = data.bookmarksFoldersArr.reverse()
    }
    callback(data)
  })
}

const saveGroup = (tabGroupId, data) => {
  if (!data.groupsSupported) {
    return
  }
  const getNewFolderId = (name, callback) => {
    chrome.bookmarks.getSubTree(data.targetFolderId, (folder) => {
      let checkTargetFolder = folder[0].children?.filter(
        (childFold) => childFold.title == name,
      )
      if (checkTargetFolder.length > 0) {
        chrome.bookmarks.removeTree(checkTargetFolder[0].id, () => {
          chrome.bookmarks.create(
            { parentId: data.targetFolderId, title: name ? name : 'NONAME' },
            (folder) => {
              callback(folder.id)
            },
          )
        })
      } else {
        chrome.bookmarks.create(
          { parentId: data.targetFolderId, title: name ? name : 'NONAME' },
          (folder) => {
            callback(folder.id)
          },
        )
      }
    })
  }
  const selectedTabs = data.tabsArr.filter((tab) => tab.groupId == tabGroupId)
  const selectedGroup = data.groupsArr.find((group) => group.id == tabGroupId)
  if (selectedTabs.length > 0) {
    getNewFolderId(selectedGroup.title, (id) => {
      for (let i = 0; selectedTabs.length > i; i++) {
        chrome.bookmarks.create({
          parentId: id,
          title: selectedTabs[i].title,
          url: selectedTabs[i].url,
        })
      }
    })
  }
}

const openGroup = (folderId, rootPath) => {
  chrome.bookmarks.search({ title: rootPath }, (rootFolder) => {
    if (rootFolder.length === 0) {
      return
    }
    chrome.bookmarks.getSubTree(rootFolder[0].id, (subTree) => {
      const children = (subTree[0]?.children || []).filter(
        (child) => !child.url,
      )
      const targetFolder = children.find((folder) => folder.id == folderId)
      if (!targetFolder) {
        return
      }
      const tabsGroupArr = []
      const bookmarks = targetFolder.children.filter((child) => child.url)
      for (let i = 0; bookmarks.length > i; i++) {
        chrome.tabs.create(
          { url: bookmarks[i].url, active: false },
          (tab) => {
            tabsGroupArr.push(tab.id)
            if (groupsSupported() && bookmarks.length == i + 1) {
              chrome.tabs.group({ tabIds: tabsGroupArr }, (groupId) => {
                chrome.tabGroups.update(
                  groupId,
                  { title: targetFolder.title },
                  () => {},
                )
              })
            }
          },
        )
      }
    })
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openGroup') {
    openGroup(message.folderId, message.rootPath)
    sendResponse({ ok: true })
  }
})

const autoSave = () => {
  chrome.storage.local.get(['autosave']).then((result) => {
    if (result?.autosave && result?.autosave === 'on' && groupsSupported()) {
      getData((data) => {
        if (data) {
          data.groupsArr.forEach((group) => {
            saveGroup(group.id, data)
          })
        }
      })
    }
  })
}

chrome.alarms.create('autosave', {
  delayInMinutes: 1,
  periodInMinutes: 1,
})

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === 'autosave') {
    autoSave()
  }
})
