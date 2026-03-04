import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Image, StatusBar,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { router } from 'expo-router'

type UploadStep = 'select' | 'details' | 'uploading' | 'done'

export default function UploadScreen() {
  const [step, setStep] = useState<UploadStep>('select')
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')

  async function pickVideo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Ruxsat kerak', 'Video tanlash uchun galereya ruxsatini bering')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    })

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri)
      setStep('details')
    }
  }

  async function pickThumbnail() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setThumbnailUri(result.assets[0].uri)
    }
  }

  async function uploadFile(uri: string, bucket: string, path: string): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const contentType = bucket === 'videos' ? 'video/mp4' : 'image/jpeg'
    const fileName = path.split('/').pop() ?? 'file'

    const formData = new FormData()
    formData.append('file', { uri, name: fileName, type: contentType } as any)

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        body: formData,
      }
    )

    if (!uploadResponse.ok) {
      const err = await uploadResponse.text()
      console.error('Upload error:', err)
      return null
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async function handleUpload() {
    if (!title.trim()) { Alert.alert('Xato', 'Sarlavha kiriting'); return }
    if (!videoUri) { Alert.alert('Xato', 'Video tanlang'); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { Alert.alert('Xato', 'Login qiling'); return }

    setStep('uploading')

    try {
      const timestamp = Date.now()
      const userId = session.user.id

      // 1. Thumbnail yuklash
      let thumbnailUrl: string | null = null
      if (thumbnailUri) {
        setUploadStatus('Muqova yuklanmoqda...')
        setUploadProgress(10)
        thumbnailUrl = await uploadFile(thumbnailUri, 'thumbnails', `${userId}/${timestamp}.jpg`)
        setUploadProgress(30)
      }

      // 2. Video yuklash
      setUploadStatus('Video yuklanmoqda... Bu biroz vaqt olishi mumkin')
      setUploadProgress(40)
      const videoUrl = await uploadFile(videoUri, 'videos', `${userId}/${timestamp}.mp4`)
      setUploadProgress(85)

      if (!videoUrl) throw new Error('Video yuklanmadi')

      // 3. Database ga saqlash
      setUploadStatus('Ma\'lumotlar saqlanmoqda...')
      const { error } = await supabase.from('videos').insert({
        channel_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
      })

      if (error) throw error

      setUploadProgress(100)
      setUploadStatus('Muvaffaqiyatli yuklandi!')
      setStep('done')
    } catch (err: any) {
      Alert.alert('Xato', err.message ?? 'Yuklashda xato yuz berdi')
      setStep('details')
    }
  }

  function reset() {
    setStep('select')
    setVideoUri(null)
    setThumbnailUri(null)
    setTitle('')
    setDescription('')
    setUploadProgress(0)
    setUploadStatus('')
  }

  // --- SELECT STEP ---
  if (step === 'select') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Video yuklash</Text>
        </View>
        <View style={styles.selectContent}>
          <TouchableOpacity style={styles.selectBox} onPress={pickVideo}>
            <View style={styles.selectIcon}>
              <Ionicons name="cloud-upload" size={56} color="#0f0f0f" />
            </View>
            <Text style={styles.selectTitle}>Video tanlang</Text>
            <Text style={styles.selectDesc}>Galereyadan video tanlang</Text>
            <View style={styles.selectBtn}>
              <Text style={styles.selectBtnText}>Galereya</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // --- UPLOADING STEP ---
  if (step === 'uploading') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#0f0f0f" />
        <Text style={styles.uploadStatusText}>{uploadStatus}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{uploadProgress}%</Text>
      </View>
    )
  }

  // --- DONE STEP ---
  if (step === 'done') {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>Muvaffaqiyatli yuklandi!</Text>
        <Text style={styles.doneDesc}>Videongiz hozir efirda</Text>
        <View style={styles.doneActions}>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)/' as any)}>
            <Text style={styles.doneBtnText}>Bosh sahifa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtnOutline} onPress={reset}>
            <Text style={styles.doneBtnOutlineText}>Yana yuklash</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // --- DETAILS STEP ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={reset}>
          <Ionicons name="close" size={24} color="#0f0f0f" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video tafsilotlari</Text>
        <TouchableOpacity
          style={[styles.publishBtn, !title.trim() && styles.publishBtnDisabled]}
          onPress={handleUpload}
          disabled={!title.trim()}
        >
          <Text style={styles.publishBtnText}>Yuklash</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={{ gap: 20, padding: 16 }}>
        {/* Thumbnail */}
        <TouchableOpacity style={styles.thumbnailPicker} onPress={pickThumbnail}>
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={styles.thumbnailPreview} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="image-outline" size={36} color="#909090" />
              <Text style={styles.thumbnailPlaceholderText}>Muqova tanlash (ixtiyoriy)</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Video selected indicator */}
        <View style={styles.videoSelected}>
          <Ionicons name="videocam" size={20} color="#0f0f0f" />
          <Text style={styles.videoSelectedText} numberOfLines={1}>
            Video tanlandi ✓
          </Text>
          <TouchableOpacity onPress={pickVideo}>
            <Text style={styles.changeText}>O'zgartirish</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Sarlavha *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Videongizga sarlavha bering"
            placeholderTextColor="#909090"
            maxLength={100}
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Tavsif</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Video haqida qisqacha ma'lumot"
            placeholderTextColor="#909090"
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f0f0f' },
  publishBtn: { backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  publishBtnDisabled: { opacity: 0.3 },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  selectContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  selectBox: {
    width: '100%', borderWidth: 2, borderColor: '#e5e5e5', borderRadius: 16,
    borderStyle: 'dashed', padding: 40, alignItems: 'center', gap: 12,
  },
  selectIcon: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#f2f2f2',
    justifyContent: 'center', alignItems: 'center',
  },
  selectTitle: { fontSize: 18, fontWeight: '700', color: '#0f0f0f' },
  selectDesc: { fontSize: 14, color: '#606060' },
  selectBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8,
  },
  selectBtnText: { color: '#fff', fontWeight: '700' },
  uploadStatusText: { fontSize: 15, color: '#0f0f0f', fontWeight: '600', textAlign: 'center' },
  progressBar: {
    width: '80%', height: 6, backgroundColor: '#e5e5e5', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0f0f0f', borderRadius: 3 },
  progressText: { fontSize: 13, color: '#606060' },
  doneIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
  },
  doneTitle: { fontSize: 22, fontWeight: '800', color: '#0f0f0f' },
  doneDesc: { fontSize: 14, color: '#606060' },
  doneActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  doneBtn: { backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 11 },
  doneBtnText: { color: '#fff', fontWeight: '700' },
  doneBtnOutline: {
    borderWidth: 1.5, borderColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 11,
  },
  doneBtnOutlineText: { color: '#0f0f0f', fontWeight: '700' },
  form: { flex: 1 },
  thumbnailPicker: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#f2f2f2', borderWidth: 1, borderColor: '#e5e5e5',
  },
  thumbnailPreview: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  thumbnailPlaceholderText: { fontSize: 14, color: '#909090' },
  videoSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f2f2f2', borderRadius: 10, padding: 12,
  },
  videoSelectedText: { flex: 1, fontSize: 14, color: '#0f0f0f', fontWeight: '500' },
  changeText: { fontSize: 13, color: '#065fd4', fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#0f0f0f' },
  input: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#0f0f0f', backgroundColor: '#fafafa',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#909090', textAlign: 'right' },
})
