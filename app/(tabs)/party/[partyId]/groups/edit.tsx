import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { ArrowLeft, UserPlus, Trash2, PlusCircle, Save, AlertCircle } from 'lucide-react-native'
import Colors, { API_BASE_URL } from '@/constants'
import { UserRow, QuestionRow, GroupRow } from '@/types/database'

const AppColors = Colors.dark

interface FoundUser extends UserRow {
  isAlreadyMember?: boolean
  isInvited?: boolean
}

interface EditableQuestion extends QuestionRow {
  isNew?: boolean
  localText?: string
}

const GroupEditsScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const router = useRouter()
  const { userId, isLoaded: authLoaded } = useAuth()

  const [groupDetails, setGroupDetails] = useState<GroupRow | null>(null)
  const [isLoadingGroup, setIsLoadingGroup] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [isSavingAll, setIsSavingAll] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoundUser[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [currentGroupUserIds, setCurrentGroupUserIds] = useState<string[]>([])
  const [currentInvitedUserIds, setInvitedUserIds] = useState<string[]>([])

  const [questions, setQuestions] = useState<EditableQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [initialQuestionsLoaded, setInitialQuestionsLoaded] = useState(false)

  useEffect(() => {
    if (!authLoaded || !partyId || !userId) {
      if (authLoaded && !userId) {
        setIsLoadingGroup(false)
        Alert.alert('Authentication Error', 'You must be signed in to edit a group.')
        router.replace(`/party/${partyId || ''}`)
      }
      return
    }

    const fetchUserGroup = async () => {
      setIsLoadingGroup(true)
      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`, {})

        if (response.status === 404) {
          Alert.alert(
            'No Group Found',
            'You are not part of any group for this event or the group does not exist.',
          )
          setGroupDetails(null)
          setIsAuthorized(false)
          router.replace(`/party/${partyId}`)
          return
        }
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to fetch your group details.')
        }

        const groupData: GroupRow = await response.json()
        setGroupDetails(groupData)

        if (groupData.creator_user_id === userId) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
          Alert.alert(
            'Unauthorized',
            'You are not the creator of this group and cannot make edits.',
          )
        }
      } catch (error) {
        console.error('Fetch User Group Error:', error)
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Could not load your group information.',
        )
        setGroupDetails(null)
        setIsAuthorized(false)
        if (partyId) router.replace(`/party/${partyId}`)
        else router.back()
      } finally {
        setIsLoadingGroup(false)
      }
    }

    fetchUserGroup()
  }, [authLoaded, partyId, userId, router])

  const fetchGroupMembersAndInvited = useCallback(async () => {
    if (!groupDetails?.group_id || !isAuthorized) return
    try {
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/members`, {})
      if (!response.ok) throw new Error('Failed to fetch group member statuses')
      const groupMembers: {
        members: { userId: string; username?: string; status: string }[]
        count?: number
      } = await response.json()
      setCurrentGroupUserIds(
        groupMembers.members.filter((m) => m.status === 'joined').map((m) => m.userId),
      )
      setInvitedUserIds(
        groupMembers.members.filter((m) => m.status === 'invited').map((m) => m.userId),
      )
    } catch (error) {
      console.error('Error fetching member statuses:', error)
    }
  }, [groupDetails, isAuthorized])

  const fetchGroupQuestions = useCallback(async () => {
    if (!groupDetails?.group_id || !isAuthorized) return
    setIsLoadingQuestions(true)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/questions`, {})
      if (!response.ok) throw new Error('Failed to fetch questions for the group.')
      const data: QuestionRow[] = await response.json()
      setQuestions(
        data
          .map((q) => ({ ...q, localText: q.question_text, isNew: false }))
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
      )
      setInitialQuestionsLoaded(true)
    } catch (error) {
      console.error('Fetch Questions Error:', error)
      Alert.alert('Error', 'Could not load group questions.')
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [groupDetails, isAuthorized])

  const handleSearchUsers = useCallback(async () => {
    if (!groupDetails || !isAuthorized) return
    setIsSearchingUsers(true)
    try {
      const response = await fetch(`${API_BASE_URL}/party/${partyId}/users`, {})
      if (!response.ok) throw new Error('Failed to search users')
      let users: UserRow[] = await response.json()
      users = users.filter((u) => u.user_id !== userId)

      setSearchResults(
        users.map((u) => ({
          ...u,
          isAlreadyMember: currentGroupUserIds.includes(u.user_id),
          isInvited: currentInvitedUserIds.includes(u.user_id),
        })),
      )
    } catch (error) {
      console.error('Search Users Error:', error)
      Alert.alert('Error', 'Could not perform user search.')
      setSearchResults([])
    } finally {
      setIsSearchingUsers(false)
    }
  }, [
    groupDetails,
    isAuthorized,
    partyId,
    userId,
    currentGroupUserIds,
    currentInvitedUserIds,
    setIsSearchingUsers,
    setSearchResults,
  ])

  useEffect(() => {
    if (groupDetails && isAuthorized) {
      fetchGroupMembersAndInvited()
      fetchGroupQuestions()
      handleSearchUsers()
    }
  }, [
    groupDetails,
    isAuthorized,
    currentInvitedUserIds,
    handleSearchUsers,
    fetchGroupQuestions,
    fetchGroupMembersAndInvited,
  ])

  const handleInviteUser = async (targetUserIdToInvite: string) => {
    if (!groupDetails?.group_id || !isAuthorized) return
    try {
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitee_user_id: targetUserIdToInvite, inviter_user_id: userId }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Failed to send invitation.')
      }
      Alert.alert('Success', 'Invitation sent successfully!')
      setCurrentGroupUserIds((prevIds) => [...prevIds, targetUserIdToInvite])

      setSearchResults((prevResults) =>
        prevResults.map((user) =>
          user.user_id === targetUserIdToInvite ? { ...user, isInvited: true } : user,
        ),
      )
    } catch (error) {
      console.error('Invite User Error:', error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not send the invitation.',
      )
    }
  }

  const handleQuestionTextChange = (id: string, text: string) => {
    setQuestions((qs) => qs.map((q) => (q.question_id === id ? { ...q, localText: text } : q)))
  }

  const handleAddNewQuestion = () => {
    if (!groupDetails || !isAuthorized) return
    const newQuestionId = `new-${Date.now()}`
    setQuestions((qs) => [
      ...qs,
      {
        question_id: newQuestionId,
        group_id: groupDetails.group_id,
        question_text: '',
        localText: '',
        order_index: qs.length,
        created_at: new Date().toISOString(),
        isNew: true,
      },
    ])
  }

  const handleRemoveQuestion = (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.question_id !== id))
  }

  const handleSaveAllQuestionChanges = async () => {
    if (!groupDetails?.group_id || !isAuthorized || !initialQuestionsLoaded) {
      Alert.alert(
        'Error',
        'Cannot save questions at this time. Ensure group is loaded and you are authorized.',
      )
      return
    }
    setIsSavingAll(true)
    try {
      const originalQuestionsResponse = await fetch(
        `${API_BASE_URL}/group/${groupDetails.group_id}/questions`,
        {},
      )
      let originalQuestions: QuestionRow[] = []
      if (originalQuestionsResponse.ok) {
        originalQuestions = await originalQuestionsResponse.json()
      }

      const currentQuestionIds = new Set(questions.map((q) => q.question_id))
      const questionIdsToDelete = originalQuestions
        .filter((oq) => !currentQuestionIds.has(oq.question_id) && !(oq as EditableQuestion).isNew)
        .map((oq) => oq.question_id)

      const payload = {
        questionsToUpdate: questions
          .filter(
            (q) =>
              !q.isNew &&
              (q.localText !== q.question_text ||
                originalQuestions.find((oq) => oq.question_id === q.question_id)?.order_index !==
                  questions.findIndex((pq) => pq.question_id === q.question_id)),
          )
          .map((q, index) => ({
            question_id: q.question_id,
            question_text: q.localText,
            order_index: questions.findIndex((pq) => pq.question_id === q.question_id),
          })),
        questionsToAdd: questions
          .filter((q) => q.isNew)
          .map((q) => ({
            question_text: q.localText,
            order_index: questions.findIndex((pq) => pq.question_id === q.question_id),
          })),
        questionIdsToDelete: questionIdsToDelete,
      }

      if (
        payload.questionsToUpdate.length === 0 &&
        payload.questionsToAdd.length === 0 &&
        payload.questionIdsToDelete.length === 0
      ) {
        Alert.alert('No Changes', 'No changes detected in questions.')
        setIsSavingAll(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save question changes.')
      }

      Alert.alert('Success', 'Question changes saved successfully!')
      fetchGroupQuestions()
    } catch (error) {
      console.error('Save All Changes Error:', error)
      Alert.alert(
        'Error Saving Changes',
        error instanceof Error ? error.message : 'An unexpected error occurred while saving.',
      )
    } finally {
      setIsSavingAll(false)
    }
  }

  const renderSearchResultItem = ({ item }: { item: FoundUser }) => (
    <View style={styles.searchResultItem}>
      <Image
        source={{ uri: `${API_BASE_URL}/user/${item.user_id}/profile-picture` }}
        style={styles.userPfp}
      />
      <Text style={styles.usernameText}>{item.username}</Text>
      {item.isAlreadyMember ? (
        <Text style={styles.invitedStatusText}>Member</Text>
      ) : item.isInvited ? (
        <Text style={styles.invitedStatusText}>Invited</Text>
      ) : (
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={async () => await handleInviteUser(item.user_id)}
        >
          <UserPlus size={20} color={AppColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  )

  const renderQuestionItem = ({ item, index }: { item: EditableQuestion; index: number }) => (
    <View style={styles.questionItem}>
      <TextInput
        style={styles.questionInput}
        value={item.localText}
        onChangeText={(text) => handleQuestionTextChange(item.question_id, text)}
        placeholder={`Question ${index + 1}`}
        placeholderTextColor={AppColors.textGray}
        multiline
      />
      <TouchableOpacity
        onPress={() => handleRemoveQuestion(item.question_id)}
        style={styles.removeButton}
      >
        <Trash2 size={20} color={AppColors.accent} />
      </TouchableOpacity>
    </View>
  )

  if (isLoadingGroup || !authLoaded) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>Loading Group Details...</Text>
      </View>
    )
  }

  if (!groupDetails) {
    return (
      <View style={styles.loaderContainer}>
        <AlertCircle size={48} color={AppColors.yellow400} />
        <Text style={styles.errorText}>
          Could not load your group information or no group found for this event.
        </Text>
        <TouchableOpacity
          onPress={() => (partyId ? router.replace(`/party/${partyId}`) : router.back())}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Back to Event</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!isAuthorized) {
    return (
      <View style={styles.loaderContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              partyId && groupDetails
                ? router.replace(`/party/${partyId}/groups/${groupDetails.group_id}`)
                : router.back()
            }
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={AppColors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Unauthorized</Text>
          <View style={{ width: 24 }} />
        </View>
        <AlertCircle size={48} color={AppColors.yellow400} style={{ marginTop: 50 }} />
        <Text style={styles.errorText}>You are not authorized to edit this group.</Text>
        <TouchableOpacity
          onPress={() =>
            partyId && groupDetails
              ? router.replace(`/party/${partyId}/groups/${groupDetails.group_id}`)
              : router.back()
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Back to Group Details</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={AppColors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Your Group</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Invite Members</Text>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor={AppColors.textGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchUsers}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={handleSearchUsers}
            style={styles.searchButton}
            disabled={isSearchingUsers}
          >
            {isSearchingUsers ? (
              <ActivityIndicator size="small" color={AppColors.white} />
            ) : (
              <Text style={{ color: AppColors.white }}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
        {isSearchingUsers && searchResults.length === 0 && (
          <ActivityIndicator color={AppColors.white} style={{ marginVertical: 10 }} />
        )}
        {searchResults.length > 0 && (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={(item) => item.user_id}
            style={styles.searchResultsList}
            nestedScrollEnabled
          />
        )}
        {!isSearchingUsers && searchResults.length === 0 && searchQuery.length > 1 && (
          <Text style={styles.emptyStateText}>No users found matching your search.</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderWithAction}>
          <Text style={styles.sectionTitle}>Most Likely Questions</Text>
          <TouchableOpacity onPress={handleAddNewQuestion} style={styles.addButton}>
            <PlusCircle size={22} color={AppColors.primary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {isLoadingQuestions && !initialQuestionsLoaded ? (
          <ActivityIndicator color={AppColors.white} style={{ marginVertical: 20 }} />
        ) : questions.length > 0 ? (
          <FlatList
            data={questions}
            renderItem={renderQuestionItem}
            keyExtractor={(item) => item.question_id}
            style={styles.questionsList}
            nestedScrollEnabled
          />
        ) : (
          <Text style={styles.emptyStateText}>No questions yet. Add some for your group!</Text>
        )}
        {(questions.length > 0 || (initialQuestionsLoaded && questions.length === 0)) && (
          <TouchableOpacity
            style={[styles.saveButton, isSavingAll && styles.disabledButton]}
            onPress={handleSaveAllQuestionChanges}
            disabled={isSavingAll || isLoadingQuestions}
          >
            {isSavingAll ? (
              <ActivityIndicator color={AppColors.white} />
            ) : (
              <>
                <Save size={18} color={AppColors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Save Questions</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 50,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    paddingHorizontal: 20,
  },
  loaderText: {
    color: AppColors.white,
    marginTop: 10,
  },
  errorText: {
    color: AppColors.yellow400,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    color: AppColors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: 20,
    padding: 15,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginBottom: 15,
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: AppColors.inputBg,
    color: AppColors.white,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 8,
    fontSize: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    minHeight: Platform.OS === 'ios' ? 42 : 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsList: {
    maxHeight: 180,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  userPfp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  usernameText: {
    flex: 1,
    color: AppColors.white,
    fontSize: 15,
  },
  inviteButton: {
    padding: 8,
    marginLeft: 8,
  },
  invitedStatusText: {
    color: AppColors.textGray,
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  questionsList: {
    maxHeight: 350,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: AppColors.inputBg,
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  questionInput: {
    flex: 1,
    color: AppColors.white,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 5,
    minHeight: 40,
  },
  removeButton: {
    padding: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: AppColors.inputBg,
    borderRadius: 20,
  },
  addButtonText: {
    color: AppColors.primary,
    marginLeft: 5,
    fontWeight: '500',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    minHeight: 48,
  },
  saveButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: AppColors.disabled,
  },
  emptyStateText: {
    color: AppColors.textGray,
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 14,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginTop: 20,
    minHeight: 50,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
})

export default GroupEditsScreen
