const FOLDER_NAME = 'Projects'

var body = document.getElementsByTagName('body')[0]
var groupsListWrap = document.getElementsByClassName('groups-list')[0]

const getData = (callback) => {
  let resData = {
    groupsArr: [],
    tabsArr: [],
    targetFolderId: '',
  }

  chrome.tabGroups.query({}, (groups) => {
    resData.groupsArr = groups
    chrome.tabs.query({}, (tabs) => {
      resData.tabsArr = tabs
      chrome.bookmarks.search({ title: FOLDER_NAME }, (folder) => {
        if (folder.length > 0) {
          resData.targetFolderId = folder[0].id
          callback(resData)
        } else {
          chrome.bookmarks.create({ title: FOLDER_NAME }, (folder) => {
            resData.targetFolderId = folder.id
            callback(resData)
          })
        }
      })
    })
  })
}

const saveGroup = (tabGroupId, data) => {
  const getNewFolderId = (name, callback) => {
    chrome.bookmarks.getSubTree(data.targetFolderId, (folder) => {
      let chexkTargetFolder = folder[0].children?.filter(
        (childFold) => childFold.title == name,
      )
      if (chexkTargetFolder.length > 0) {
        chrome.bookmarks.removeTree(chexkTargetFolder[0].id, () => {
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
      selectedTabs.forEach((tab) => {
        chrome.bookmarks.create(
          { parentId: id, title: tab.title, url: tab.url },
          (e) => {
            console.log(e)
          },
        )
      })
    })
  }
}

getData((data) => {
  console.log(data)
  let groupsListHtml = ''
  data.groupsArr.forEach((group) => {
    groupsListHtml += `<button class="js-save" data-groupId="${group.id}">${
      group.title ? group.title : 'NONAME'
    }</button>`
  })
  groupsListWrap.innerHTML = groupsListHtml

  body.addEventListener('click', function (event) {
    if (event.target.classList.contains('js-save')) {
      const groupId = event.target.getAttribute('data-groupId')
      saveGroup(groupId, data)
    }
  })
})
