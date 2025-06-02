import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
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
import { API_BASE_URL } from '@/constants'
import { UserRow, QuestionRow, GroupRow } from '@/types/database'

const PageColors = {
  background: '#100a26',
  cardBackground: 'rgba(58, 31, 93, 0.85)',
  inputBackground: 'rgba(255, 255, 255, 0.1)',
  textWhite: '#FFFFFF',
  textGray: '#A0A0A0',
  textGray300: '#D1D5DB',
  primary: '#7c3aed',
  accent: '#be185d',
  disabled: '#555',
  warningText: '#FFD700',
}

interface FoundUser extends UserRow {
  isAlreadyMember?: boolean
  isInvited?: boolean
}
interface EditableQuestion extends QuestionRow {
  isNew?: boolean
  localText?: string
}

const MainListSectionTypes = {
  INVITE_MEMBERS: 'INVITE_MEMBERS',
  QUESTIONS: 'QUESTIONS',
}

const screenLayoutData = [
  { type: MainListSectionTypes.INVITE_MEMBERS, id: 'invite_section_card' },
  // { type: MainListSectionTypes.QUESTIONS, id: 'questions_section_card' },
]

const GroupEditsScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const router = useRouter()
  const { userId, isLoaded: authLoaded } = useAuth()

  const [groupDetails, setGroupDetails] = useState<GroupRow | null>(null)
  const [isLoadingGroup, setIsLoadingGroup] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FoundUser[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [currentGroupUserIds, setCurrentGroupUserIds] = useState<string[]>([])
  const [currentInvitedUserIds, setInvitedUserIds] = useState<string[]>([])
  const [requestedUserIds, setRequestedUserIds] = useState<string[]>([])
  const [questions, setQuestions] = useState<EditableQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [initialQuestionsLoaded, setInitialQuestionsLoaded] = useState(false)

  useEffect(() => {
    if (!authLoaded) {
      setIsLoadingGroup(true)
      return
    }
    if (!userId || !partyId) {
      setIsLoadingGroup(false)
      if (!userId) Alert.alert('Authentication Error', 'You must be signed in to edit a group.')
      if (partyId) router.replace(`/party/${partyId}`)
      else router.back()
      return
    }

    const fetchUserGroup = async () => {
      setIsLoadingGroup(true)
      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)
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
          const errorData = await response
            .json()
            .catch(() => ({ message: 'Failed to fetch your group details.' }))
          throw new Error(errorData.message)
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
          router.replace(`/party/${partyId}/groups/${groupData.group_id}`)
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
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/members`)
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to fetch group member statuses' }))
        throw new Error(errorData.message)
      }
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
      setRequestedUserIds(
        groupMembers.members.filter((m) => m.status === 'requested').map((m) => m.userId),
      )
    } catch (error) {
      console.error('Error fetching member statuses:', error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not load group member information.',
      )
      setCurrentGroupUserIds([])
      setInvitedUserIds([])
      setRequestedUserIds([])
    }
  }, [groupDetails, isAuthorized])

  const fetchGroupQuestions = useCallback(async () => {
    if (!groupDetails?.group_id || !isAuthorized) return
    setIsLoadingQuestions(true)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/questions`)
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to fetch questions for the group.' }))
        throw new Error(errorData.message)
      }
      const data: QuestionRow[] = await response.json()
      setQuestions(
        data
          .map((q) => ({ ...q, localText: q.question_text, isNew: false }))
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
      )
      setInitialQuestionsLoaded(true)
    } catch (error) {
      console.error('Fetch Questions Error:', error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not load group questions.',
      )
      setQuestions([])
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [groupDetails, isAuthorized])

  useEffect(() => {
    if (groupDetails && isAuthorized) {
      fetchGroupMembersAndInvited()
      fetchGroupQuestions()
    }
  }, [groupDetails, isAuthorized, fetchGroupMembersAndInvited, fetchGroupQuestions])

  const handleSearchUsers = useCallback(async () => {
    if (!groupDetails?.group_id || !isAuthorized) {
      setSearchResults([])
      setIsSearchingUsers(false)
      return
    }
    setIsSearchingUsers(true)
    try {
      const response = await fetch(`${API_BASE_URL}/party/${partyId}/users`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to search users' }))
        throw new Error(errorData.message)
      }
      let users: (UserRow & {status: boolean})[] = await response.json()
      users = users.filter((u) => u.user_id !== userId && u.status === true)
      const filteredUsers = users.filter((u) =>
        u.username?.toLowerCase().startsWith(searchQuery.toLowerCase()),
      )
      const formattedUsers: FoundUser[] = filteredUsers.map((u) => ({
        ...u,
        isAlreadyMember: currentGroupUserIds.includes(u.user_id),
        isInvited: currentInvitedUserIds.includes(u.user_id),
      }))
      formattedUsers.sort((a, b) => {
        const aIsRequested = requestedUserIds.includes(a.user_id)
        const bIsRequested = requestedUserIds.includes(b.user_id)
        if (aIsRequested && !bIsRequested) return -1
        if (!aIsRequested && bIsRequested) return 1
        return 0
      })
      setSearchResults(formattedUsers)
    } catch (error) {
      console.error('Search Users Error:', error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not perform user search.',
      )
      setSearchResults([])
    } finally {
      setIsSearchingUsers(false)
    }
  }, [
    groupDetails?.group_id,
    isAuthorized,
    searchQuery,
    partyId,
    userId,
    currentGroupUserIds,
    currentInvitedUserIds,
    requestedUserIds,
  ])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (groupDetails && isAuthorized) handleSearchUsers()
    }, 300)
    return () => clearTimeout(handler)
  }, [
    searchQuery,
    groupDetails,
    isAuthorized,
    currentGroupUserIds,
    currentInvitedUserIds,
    requestedUserIds,
    handleSearchUsers,
  ])

  const handleInviteUser = async (targetUserIdToInvite: string) => {
    if (!groupDetails?.group_id || !isAuthorized || isProcessingAction !== null) return
    setIsProcessingAction(targetUserIdToInvite)
    try {
      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitee_user_id: targetUserIdToInvite, inviter_user_id: userId }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to send invitation.' }))
        throw new Error(err.message)
      }
      Alert.alert('Success', 'Invitation sent successfully!')
      setInvitedUserIds((prevIds) => [...prevIds, targetUserIdToInvite])
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
    } finally {
      setIsProcessingAction(null)
    }
  }

  const handleRespondToRequest = async (targetUserId: string, action: 'accept' | 'decline') => {
    if (!groupDetails?.group_id || !isAuthorized || isProcessingAction !== null) return
    setIsProcessingAction(targetUserId)
    try {
      const response = await fetch(
        `${API_BASE_URL}/group/${groupDetails.group_id}/requests/${targetUserId}/respond`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ response: action }),
        },
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to process request.' }))
        throw new Error(err.message)
      }
      Alert.alert(
        'Success',
        `Request ${action === 'accept' ? 'accepted' : 'declined'} successfully!`,
      )
      await fetchGroupMembersAndInvited()
      handleSearchUsers()
    } catch (error) {
      console.error(`Error responding to request (${action}):`, error)
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not process the request.',
      )
    } finally {
      setIsProcessingAction(null)
    }
  }

  const handleQuestionTextChange = (id: string, text: string) => {
    setQuestions((qs) => qs.map((q) => (q.question_id === id ? { ...q, localText: text } : q)))
  }

  const handleAddNewQuestion = () => {
    if (!groupDetails?.group_id || !isAuthorized) return
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
        'Cannot save questions at this time. Ensure group is loaded, you are authorized, and questions were initially loaded.',
      )
      return
    }
    setIsSavingAll(true)
    try {
      const originalQuestionsResponse = await fetch(
        `${API_BASE_URL}/group/${groupDetails.group_id}/questions`,
      )
      let originalQuestions: QuestionRow[] = []
      if (originalQuestionsResponse.ok) {
        originalQuestions = await originalQuestionsResponse.json()
      } else {
        console.warn(
          'Could not fetch original questions before saving. Deletions might be missed if state is inconsistent.',
        )
      }

      const currentQuestionIds = new Set(questions.map((q) => q.question_id))
      const questionIdsToDelete = originalQuestions
        .filter((oq) => !currentQuestionIds.has(oq.question_id) && !(oq as EditableQuestion).isNew)
        .map((oq) => oq.question_id)

      const payload = {
        questionsToUpdate: questions
          .filter((q) => !q.isNew)
          .map((q) => {
            const originalQ = originalQuestions.find((oq) => oq.question_id === q.question_id)
            const currentOrderIndex = questions.findIndex((pq) => pq.question_id === q.question_id)
            if (
              originalQ &&
              (q.localText !== originalQ.question_text ||
                currentOrderIndex !== originalQ.order_index)
            ) {
              return {
                question_id: q.question_id,
                question_text: q.localText,
                order_index: currentOrderIndex,
              }
            }
            return null
          })
          .filter((item) => item !== null),
        questionsToAdd: questions
          .filter((q) => q.isNew && q.localText?.trim() !== '')
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
        Alert.alert('No Changes', 'No changes detected in questions to save.')
        setIsSavingAll(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/group/${groupDetails.group_id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Failed to save question changes.' }))
        throw new Error(errorData.message)
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

  const renderSearchResultItem = ({ item }: { item: FoundUser }) => {
    const isRequested = requestedUserIds.includes(item.user_id)
    const isProcessingThisUser = isProcessingAction === item.user_id

    return (
      <View style={styles.searchResultItem}>
        <Image
          source={{ uri: `${API_BASE_URL}/user/${item.user_id}/profile-picture` }}
          style={styles.userPfp}
        />
        <Text style={styles.usernameText}>{item.username}</Text>
        {isRequested && isAuthorized ? (
          <View style={styles.requestActionsContainer}>
            <TouchableOpacity
              style={styles.acceptRequestButton}
              onPress={() => handleRespondToRequest(item.user_id, 'accept')}
              disabled={isProcessingAction !== null}
            >
              {isProcessingThisUser && !isSavingAll ? (
                <ActivityIndicator size="small" color={PageColors.textWhite} />
              ) : (
                <Text style={styles.requestButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineRequestButton}
              onPress={() => handleRespondToRequest(item.user_id, 'decline')}
              disabled={isProcessingAction !== null}
            >
              {isProcessingThisUser && !isSavingAll ? (
                <ActivityIndicator size="small" color={PageColors.textWhite} />
              ) : (
                <Text style={styles.requestButtonText}>Decline</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : item.isAlreadyMember ? (
          <Text style={styles.invitedStatusText}>Member</Text>
        ) : item.isInvited ? (
          <Text style={styles.invitedStatusText}>Invited</Text>
        ) : (
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => handleInviteUser(item.user_id)}
            disabled={isProcessingAction !== null}
          >
            <UserPlus size={20} color={PageColors.primary} />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  const renderQuestionItem = ({ item, index }: { item: EditableQuestion; index: number }) => (
    <View style={styles.questionItem}>
      <TextInput
        style={styles.questionInput}
        value={item.localText}
        onChangeText={(text) => handleQuestionTextChange(item.question_id, text)}
        placeholder={`Question ${index + 1}`}
        placeholderTextColor={PageColors.textGray}
        multiline
      />
      <TouchableOpacity
        onPress={() => handleRemoveQuestion(item.question_id)}
        style={styles.removeButton}
      >
        <Trash2 size={20} color={PageColors.accent} />
      </TouchableOpacity>
    </View>
  )

  const renderPageHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft size={24} color={PageColors.textWhite} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Your Group</Text>
      <View style={{ width: 24 }} />
      {/* Spacer */}
    </View>
  )

  const renderScreenSectionItem = ({ item }: { item: { type: string; id: string } }) => {
    switch (item.type) {
      case MainListSectionTypes.INVITE_MEMBERS:
        return (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Invite Members</Text>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by username..."
                placeholderTextColor={PageColors.textGray}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {isSearchingUsers && (
                <ActivityIndicator
                  size="small"
                  color={PageColors.textWhite}
                  style={{ marginLeft: 10 }}
                />
              )}
            </View>
            {isSearchingUsers && searchResults.length === 0 && searchQuery.trim() !== '' && (
              <ActivityIndicator color={PageColors.textWhite} style={{ marginVertical: 10 }} />
            )}
            {!isSearchingUsers && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(user) => user.user_id}
                style={styles.searchResultsList}
                scrollEnabled={true}
              />
            )}
            {!isSearchingUsers && searchResults.length === 0 && searchQuery.trim() !== '' && (
              <Text style={styles.emptyStateText}>No users found matching "{searchQuery}".</Text>
            )}
            {!isSearchingUsers && searchResults.length === 0 && searchQuery.trim() === '' && (
              <Text style={styles.emptyStateText}>
                Enter a username to search for members to invite or manage requests.
              </Text>
            )}
          </View>
        )
      case MainListSectionTypes.QUESTIONS:
        return (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderWithAction}>
              <Text style={styles.sectionTitle}>Most Likely Questions</Text>
              <TouchableOpacity onPress={handleAddNewQuestion} style={styles.addButton}>
                <PlusCircle size={22} color={PageColors.primary} />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            {isLoadingQuestions && !initialQuestionsLoaded ? (
              <ActivityIndicator color={PageColors.textWhite} style={{ marginVertical: 20 }} />
            ) : questions.length > 0 ? (
              <FlatList
                data={questions}
                renderItem={renderQuestionItem}
                keyExtractor={(question) => question.question_id}
                style={styles.questionsList}
                scrollEnabled={false}
              />
            ) : (
              <Text style={styles.emptyStateText}>No questions yet. Add some for your group!</Text>
            )}
            {(questions.length > 0 || initialQuestionsLoaded) && (
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (isSavingAll || isLoadingQuestions) && styles.disabledButton,
                ]}
                onPress={handleSaveAllQuestionChanges}
                disabled={isSavingAll || isLoadingQuestions}
              >
                {isSavingAll ? (
                  <ActivityIndicator color={PageColors.textWhite} />
                ) : (
                  <>
                    <Save size={18} color={PageColors.textWhite} style={{ marginRight: 8 }} />
                    <Text style={styles.saveButtonText}>Save Questions</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )
      default:
        return null
    }
  }

  if (isLoadingGroup || !authLoaded) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={PageColors.textWhite} />
        <Text style={styles.loaderText}>
          {!authLoaded ? 'Authenticating...' : 'Loading Group Details...'}
        </Text>
      </View>
    )
  }

  if (!groupDetails) {
    return (
      <View style={styles.loaderContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (partyId ? router.replace(`/party/${partyId}`) : router.back())}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={PageColors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <AlertCircle size={48} color={PageColors.warningText} style={{ marginTop: 50 }} />
        <Text style={styles.errorText}>Could not load group information or no group found.</Text>
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
            <ArrowLeft size={24} color={PageColors.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Unauthorized</Text>
          <View style={{ width: 24 }} />
        </View>
        <AlertCircle size={48} color={PageColors.warningText} style={{ marginTop: 50 }} />
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
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={screenLayoutData}
        renderItem={renderScreenSectionItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderPageHeader}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PageColors.background },
  scrollContentContainer: { paddingBottom: 50 },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PageColors.background,
    paddingHorizontal: 20,
  },
  loaderText: { color: PageColors.textWhite, marginTop: 10, textAlign: 'center' },
  errorText: {
    color: PageColors.warningText,
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
  backButton: { padding: 5 },
  headerTitle: { color: PageColors.textWhite, fontSize: 20, fontWeight: 'bold' },
  sectionCard: {
    backgroundColor: PageColors.cardBackground,
    borderRadius: 12,
    marginHorizontal: 15,
    marginTop: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: PageColors.textWhite, marginBottom: 15 },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: PageColors.inputBackground,
    color: PageColors.textWhite,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 8,
    fontSize: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchResultsList: {
    maxHeight: 180,
    flexGrow: 0,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PageColors.inputBackground,
  },
  userPfp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: PageColors.textGray,
  },
  usernameText: { flex: 1, color: PageColors.textWhite, fontSize: 15 },
  inviteButton: { padding: 8, marginLeft: 8 },
  invitedStatusText: {
    color: PageColors.textGray,
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  requestActionsContainer: { flexDirection: 'row', alignItems: 'center' },
  acceptRequestButton: {
    backgroundColor: PageColors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  declineRequestButton: {
    backgroundColor: PageColors.accent,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  requestButtonText: {
    color: PageColors.textWhite,
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 40,
    textAlign: 'center',
  },
  questionsList: { maxHeight: 350 },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: PageColors.inputBackground,
    borderRadius: 8,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  questionInput: {
    flex: 1,
    color: PageColors.textWhite,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 5,
    minHeight: 40,
  },
  removeButton: { padding: 10 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: PageColors.inputBackground,
    borderRadius: 20,
  },
  addButtonText: { color: PageColors.primary, marginLeft: 5, fontWeight: '500', fontSize: 14 },
  saveButton: {
    backgroundColor: PageColors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    minHeight: 48,
  },
  saveButtonText: { color: PageColors.textWhite, fontSize: 16, fontWeight: 'bold' },
  disabledButton: { backgroundColor: PageColors.disabled },
  emptyStateText: {
    color: PageColors.textGray,
    textAlign: 'center',
    marginVertical: 15,
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 10,
  },
  primaryButton: {
    backgroundColor: PageColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginTop: 20,
    minHeight: 50,
  },
  primaryButtonText: { color: PageColors.textWhite, fontSize: 16, fontWeight: 'bold' },
})

export default GroupEditsScreen
