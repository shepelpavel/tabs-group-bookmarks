const body = document.getElementsByTagName('body')[0]
const groupsListWrap = document.getElementsByClassName('groups')[0]
const bookmarksListWrap = document.getElementsByClassName('bookmarks')[0]
const settingsWrap = document.getElementsByClassName('settings')[0]
const doneBlock = document.getElementsByClassName('done')[0]
const pathInput = document.getElementById('path')

const getData = (callback) => {
  let resData = {
    groupsArr: [],
    tabsArr: [],
    bookmarksFoldersArr: [],
    targetFolderId: '',
    rootPath: 'TabsGroups',
    autosave: 'off',
  }

  chrome.storage.local.get(['path']).then((result) => {
    if (result?.path) {
      resData.rootPath = result.path
    }
    pathInput.value = resData.rootPath
    chrome.storage.local.get(['autosave']).then((result) => {
      if (result?.autosave) {
        resData.autosave = result.autosave
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
        chrome.bookmarks.create(
          {
            parentId: id,
            title: selectedTabs[i].title,
            url: selectedTabs[i].url,
          },
          () => {
            showDone()
          },
        )
      }
    })
  }
}

const closeGroup = (tabGroupId, data) => {
  let tabsArr = []
  chrome.tabs.query({}, (tabs) => {
    tabs.map((tab) => {
      if (tab.groupId == tabGroupId) {
        tabsArr.push(tab.id)
      }
    })
    chrome.tabs.remove(tabsArr, () => {
      showDone()
    })
  })
}

const openGroup = (folderId, data) => {
  let tabsGroupArr = []
  targetFolderObj = data.bookmarksFoldersArr.find(
    (folder) => folder.id == folderId,
  )
  for (let i = 0; targetFolderObj.children.length > i; i++) {
    chrome.tabs.create(
      { url: targetFolderObj.children[i].url, active: false },
      (tab) => {
        tabsGroupArr.push(tab.id)
        if (targetFolderObj.children.length == i + 1) {
          chrome.tabs.group({ tabIds: tabsGroupArr }, (groupId) => {
            chrome.tabGroups.update(
              groupId,
              { title: targetFolderObj.title },
              () => {
                showDone()
              },
            )
          })
        }
      },
    )
  }
}

const showDone = () => {
  doneBlock.classList.remove('show')
  doneBlock.classList.add('show')
  initExt()
  setTimeout(() => {
    doneBlock.classList.remove('show')
  }, 300)
}

const saveRootPath = (path) => {
  chrome.storage.local.set({ path: path }).then(() => {
    showDone()
  })
}
const saveAutosave = (autosave) => {
  chrome.storage.local.set({ autosave: autosave }).then(() => {
    showDone()
  })
}

const eventsList = (event) => {
  var data = event.currentTarget.myData
  if (event.target.classList.contains('js-save')) {
    const groupId = event.target.getAttribute('data-groupId')
    saveGroup(groupId, data)
  }
  if (event.target.classList.contains('js-close')) {
    const groupId = event.target.getAttribute('data-groupId')
    closeGroup(groupId, data)
  }
  if (event.target.classList.contains('js-load')) {
    const folderId = event.target.getAttribute('data-folderId')
    openGroup(folderId, data)
  }
  if (event.target.classList.contains('js-tab')) {
    const targetTab = event.target.getAttribute('data-tab')
    const allTabs = document.getElementsByClassName('js-tab')
    const allWraps = document.getElementsByClassName('js-wrap')
    const targetWrap = document.getElementsByClassName(targetTab)[0]
    for (let tab of allTabs) {
      tab.classList.remove('active')
    }
    for (let wrap of allWraps) {
      wrap.classList.remove('active')
    }
    event.target.classList.add('active')
    targetWrap.classList.add('active')
  }
  if (event.target.classList.contains('js-save-path')) {
    const targetPath = pathInput.value
    saveRootPath(targetPath)
  }
  if (event.target.classList.contains('js-autosave')) {
    const autosaveCheckbox = document.getElementById('autosave')
    saveAutosave(autosaveCheckbox.checked ? 'on' : 'off')
  }
}

const initExt = () => {
  getData((data) => {
    body.removeEventListener('click', eventsList, false)
    console.log(data)

    let groupsListHtml = ''
    if (data.groupsArr && data.groupsArr.length > 0) {
      for (let i = 0; data.groupsArr.length > i; i++) {
        groupsListHtml += `<div class="list__item"><div class="list__item_save js-save" data-groupid="${
          data.groupsArr[i].id
        }">${
          data.groupsArr[i].title ? data.groupsArr[i].title : 'NONAME'
        }</div><div class="list__item_close js-close" data-groupid="${
          data.groupsArr[i].id
        }">X</div></div>`
      }
    }
    groupsListWrap.innerHTML = groupsListHtml

    let bookmarksListHtml = ''
    if (data.bookmarksFoldersArr && data.bookmarksFoldersArr.length > 0) {
      for (let i = 0; data.bookmarksFoldersArr.length > i; i++) {
        bookmarksListHtml += `<div class="list__item"><div class="list__item_load js-load" data-folderId="${data.bookmarksFoldersArr[i].id}">${data.bookmarksFoldersArr[i].title}</div></div>`
      }
    }
    bookmarksListWrap.innerHTML = bookmarksListHtml

    const autosaveCheckbox = document.getElementById('autosave')
    if (data.autosave === 'on') {
      autosaveCheckbox.checked = true
    } else {
      autosaveCheckbox.checked = false
    }

    body.addEventListener('click', eventsList, false)
    body.myData = data
  })
}

initExt()
