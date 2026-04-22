// 备份导出功能
async function exportBackup(clickedButton) {
  if (!confirm('确定要导出所有数据吗？\n这可能需要一些时间，包含图片和音频。')) return;

  var originalText = clickedButton ? clickedButton.textContent : '导出中...';
  if (clickedButton) {
    clickedButton.textContent = '导出中...';
    clickedButton.disabled = true;
  }

  try {
    var backupData = {
      version: 1,
      exportTime: new Date().toISOString(),
      userId: currentUser.uid,
      userData: {},
      diaries: [],
      anniversaries: [],
      comments: []
    };

    // 1. 获取用户数据（tags、collections）
    var userDoc = await db.collection('users').doc(currentUser.uid).get();
    if (userDoc.exists) {
      backupData.userData = {
        displayName: userDoc.data().displayName,
        tags: userDoc.data().tags || [],
        collections: userDoc.data().collections || [],
        theme: userDoc.data().theme || 'default'
      };
    }

    // 2. 获取所有日记
    var diariesSnapshot = await db.collection('diaries').get();
    diariesSnapshot.forEach(function(doc) {
      var data = doc.data();
      // 只导出自己创建的或共建的日记
      if (data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1)) {
        backupData.diaries.push({
          id: doc.id,
          data: {
            title: data.title,
            content: data.content,
            date: data.date.toDate ? data.date.toDate().toISOString() : data.date,
            time: data.time,
            mood: data.mood || null,
            visibility: data.visibility,
            tagId: data.tagId,
            collectionId: data.collectionId,
            imageUrls: data.imageUrls || [],
            audioUrl: data.audioUrl || null,
            coAuthors: data.coAuthors || []
          }
        });
      }
    });

    // 3. 获取所有纪念日
    var anniversariesSnapshot = await db.collection('anniversaries').get();
    anniversariesSnapshot.forEach(function(doc) {
      var data = doc.data();
      if (data.userId === currentUser.uid || (data.coAuthors && data.coAuthors.indexOf(currentUser.uid) !== -1)) {
        backupData.anniversaries.push({
          id: doc.id,
          data: {
            title: data.title,
            date: data.date,
            icon: data.icon || '💝',
            isRepeating: data.isRepeating || false,
            visibility: data.visibility || 'public',
            celebrationText: data.celebrationText || '',
            coAuthors: data.coAuthors || []
          }
        });
      }
    });

    // 4. 获取所有评论（需要查询每条评论关联的日记）
    var commentsSnapshot = await db.collection('comments').get();
    var commentsToBackup = [];

    for (var ci = 0; ci < commentsSnapshot.docs.length; ci++) {
      var doc = commentsSnapshot.docs[ci];
      var data = doc.data();
      var diaryDoc = await db.collection('diaries').doc(data.diaryId).get();
      if (diaryDoc.exists) {
        var diaryData = diaryDoc.data();
        if (diaryData.userId === currentUser.uid ||
            data.userId === currentUser.uid ||
            (diaryData.coAuthors && diaryData.coAuthors.indexOf(currentUser.uid) !== -1)) {
          commentsToBackup.push({
            id: doc.id,
            data: {
              diaryId: data.diaryId,
              content: data.content,
              parentCommentId: data.parentCommentId,
              createdAt: data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
            }
          });
        }
      }
    }
    backupData.comments = commentsToBackup;

    // 5. 创建 JSZip
    var zip = new JSZip();
    zip.file('data.json', JSON.stringify(backupData, null, 2));

    // 6. 下载所有媒体文件并添加到zip
    var mediaFolder = zip.folder('media');
    var mediaFiles = [];

    // 收集所有媒体URL
    backupData.diaries.forEach(function(diary) {
      if (diary.data.imageUrls) {
        diary.data.imageUrls.forEach(function(url, idx) {
          mediaFiles.push({ url: url, filename: 'images/diary_' + diary.id + '_' + idx + '.jpg' });
        });
      }
      if (diary.data.audioUrl) {
        mediaFiles.push({ url: diary.data.audioUrl, filename: 'audio/diary_' + diary.id + '.mp3' });
      }
    });

    // 下载每个媒体文件
    for (var i = 0; i < mediaFiles.length; i++) {
      try {
        var response = await fetch(mediaFiles[i].url);
        var blob = await response.blob();
        mediaFolder.file(mediaFiles[i].filename, blob);
        if (clickedButton) {
          clickedButton.textContent = '下载媒体 ' + (i + 1) + '/' + mediaFiles.length + '...';
        }
      } catch (e) {
        console.error('下载媒体失败:', mediaFiles[i].url, e);
      }
    }

    // 7. 生成zip文件
    var content = await zip.generateAsync({ type: 'blob' });

    // 8. 下载
    var filename = '久刹备份_' + new Date().toISOString().slice(0, 10) + '.zip';
    var link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = filename;
    link.click();

    if (clickedButton) {
      clickedButton.textContent = originalText;
      clickedButton.disabled = false;
    }
    alert('导出成功！');
  } catch (e) {
    console.error('导出失败:', e);
    if (clickedButton) {
      clickedButton.textContent = originalText;
      clickedButton.disabled = false;
    }
    alert('导出失败: ' + e.message);
  }
}

// 备份导入功能
async function importBackup(file, clickedButton) {
  if (!confirm('确定要导入备份吗？\n提示：我们将采用“智能去重合并”机制。网页中已存在的数据会自动跳过，只会为你恢复缺失的数据，绝对不会产生重复！')) return;

  var originalText = clickedButton ? clickedButton.textContent : '导入中...';
  if (clickedButton) {
    clickedButton.textContent = '导入中...';
    clickedButton.disabled = true;
  }

  try {
    // 1. 读取zip文件
    var zip = new JSZip();
    var zipContent = await zip.loadAsync(file);

    // 2. 读取data.json
    var dataJson = zip.file('data.json');
    if (!dataJson) {
      throw new Error('无效的备份文件：找不到 data.json');
    }
    var backupData = JSON.parse(await dataJson.async('string'));

    // 3. 导入用户配置
    if (backupData.userData) {
      var updates = {};
      if (backupData.userData.tags) updates.tags = backupData.userData.tags;
      if (backupData.userData.collections) updates.collections = backupData.userData.collections;
      if (backupData.userData.theme) updates.theme = backupData.userData.theme;
      if (Object.keys(updates).length > 0) {
        await db.collection('users').doc(currentUser.uid).update(updates);
        userTags = backupData.userData.tags || userTags;
        userCollections = backupData.userData.collections || userCollections;
        renderTagOptions();
        updateCollectionFilter();
      }
    }

    // 4. 导入日记（智能跳过已存在的，并按需精准上传媒体）
    var diariesAdded = 0;
    var totalDiaries = backupData.diaries.length;
    for (var i = 0; i < totalDiaries; i++) {
      var diary = backupData.diaries[i];
      
      if (clickedButton) {
        clickedButton.textContent = '处理记录 ' + (i + 1) + '/' + totalDiaries + '...';
      }

      // 检查记录是否已存在
      var existingDoc = await db.collection('diaries').doc(diary.id).get();
      if (existingDoc.exists) continue; // 智能跳过，防止重复

      var diaryData = diary.data;

      // 上传图片（仅当需要导入该记录时才上传对应的图片）
      if (diaryData.imageUrls && diaryData.imageUrls.length > 0) {
        var newImageUrls = [];
        for (var imgIdx = 0; imgIdx < diaryData.imageUrls.length; imgIdx++) {
          var zipPath = 'media/images/diary_' + diary.id + '_' + imgIdx + '.jpg';
          var zipFile = zip.file(zipPath);
          if (zipFile) {
            var blob = await zipFile.async('blob');
            var newUrl = await uploadToCloudinary(blob);
            newImageUrls.push(newUrl);
          } else {
            newImageUrls.push(diaryData.imageUrls[imgIdx]); // 降级使用旧URL
          }
        }
        diaryData.imageUrls = newImageUrls;
      }

      // 上传音频（仅当需要导入该记录时才上传对应的音频）
      if (diaryData.audioUrl) {
        var audioZipPath = 'media/audio/diary_' + diary.id + '.mp3';
        var audioZipFile = zip.file(audioZipPath);
        if (audioZipFile) {
          var audioBlob = await audioZipFile.async('blob');
          var newAudioUrl = await uploadToCloudinary(audioBlob);
          diaryData.audioUrl = newAudioUrl;
        }
      }

      // 转换日期
      if (typeof diaryData.date === 'string') {
        diaryData.date = new Date(diaryData.date);
      }

      // 添加到Firestore
      var newDiaryData = {
        title: diaryData.title || '',
        content: diaryData.content,
        date: diaryData.date,
        time: diaryData.time || '',
        mood: diaryData.mood || null,
        visibility: diaryData.visibility || 'public',
        tagId: diaryData.tagId || null,
        collectionId: diaryData.collectionId || null,
        userId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (diaryData.imageUrls) newDiaryData.imageUrls = diaryData.imageUrls;
      if (diaryData.audioUrl) newDiaryData.audioUrl = diaryData.audioUrl;
      if (diaryData.coAuthors && diaryData.coAuthors.length > 0) {
        newDiaryData.coAuthors = diaryData.coAuthors;
      }

      // 使用原始ID持久化，以便未来导入也能正确识别和拦截
      await db.collection('diaries').doc(diary.id).set(newDiaryData);
      diariesAdded++;
    }

    // 5. 导入纪念日
    var anniversariesAdded = 0;
    var totalAnns = backupData.anniversaries.length;
    for (var j = 0; j < totalAnns; j++) {
      var ann = backupData.anniversaries[j];

      var existingAnn = await db.collection('anniversaries').doc(ann.id).get();
      if (existingAnn.exists) continue; // 跳过已存在的

      var annData = ann.data;

      var newAnnData = {
        title: annData.title,
        date: annData.date,
        icon: annData.icon || '💝',
        isRepeating: annData.isRepeating || false,
        visibility: annData.visibility || 'public',
        celebrationText: annData.celebrationText || '',
        userId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (annData.coAuthors && annData.coAuthors.length > 0) {
        newAnnData.coAuthors = annData.coAuthors;
      }

      await db.collection('anniversaries').doc(ann.id).set(newAnnData);
      anniversariesAdded++;
    }

    // 6. 导入评论
    var commentsAdded = 0;
    var totalComments = backupData.comments.length;
    for (var k = 0; k < totalComments; k++) {
      var comment = backupData.comments[k];

      var existingComment = await db.collection('comments').doc(comment.id).get();
      if (existingComment.exists) continue; // 跳过已存在的

      var commentData = comment.data;

      var newCommentData = {
        diaryId: commentData.diaryId,
        content: commentData.content,
        userId: currentUser.uid,
        userDisplayName: currentUserData && currentUserData.displayName ? currentUserData.displayName : currentUser.email,
        userAvatar: currentUserData && currentUserData.avatarUrl ? currentUserData.avatarUrl : '',
        parentCommentId: commentData.parentCommentId || null,
        createdAt: new Date(commentData.createdAt)
      };

      await db.collection('comments').doc(comment.id).set(newCommentData);
      commentsAdded++;
    }

    if (clickedButton) {
      clickedButton.textContent = originalText;
      clickedButton.disabled = false;
    }

    alert('导入成功！\n' + diariesAdded + ' 篇日记\n' + anniversariesAdded + ' 个纪念日\n' + commentsAdded + ' 条评论');

    // 刷新页面
    loadDiaries();
    loadAnniversaries();
    refreshCalendar();

  } catch (e) {
    console.error('导入失败:', e);
    if (clickedButton) {
      clickedButton.textContent = originalText;
      clickedButton.disabled = false;
    }
    alert('导入失败: ' + e.message);
  }
}