import { subscriptionTiers } from "@/data/subscriptionTiers"
import { db } from "@/drizzle/db"
import { UserSubscriptionTable } from "@/drizzle/schema"
import { CACHE_TAGS, dbCache, getUserTag, revalidateDbCache } from "@/lib/cache"
import { SQL } from "drizzle-orm"

/**
 * Creates a new user subscription record
 * @param data The subscription data to insert
 * @returns The created subscription or undefined if not created
 */
export async function createUserSubscription(
  data: typeof UserSubscriptionTable.$inferInsert
) {
  try {
    const [newSubscription] = await db
      .insert(UserSubscriptionTable)
      .values(data)
      .onConflictDoNothing({
        target: UserSubscriptionTable.clerkUserId,
      })
      .returning({
        id: UserSubscriptionTable.id,
        userId: UserSubscriptionTable.clerkUserId,
      })

    if (newSubscription != null) {
      revalidateDbCache({
        tag: CACHE_TAGS.subscription,
        id: newSubscription.id,
        userId: newSubscription.userId,
      })
    }

    return newSubscription
  } catch (error) {
    console.error("Failed to create user subscription:", error)
    return undefined
  }
}

/**
 * Gets a user's subscription
 * @param userId The user ID to lookup
 * @returns The user's subscription or null if not found
 */
export function getUserSubscription(userId: string) {
  const cacheFn = dbCache(getUserSubscriptionInternal, {
    tags: [getUserTag(userId, CACHE_TAGS.subscription)],
  })

  return cacheFn(userId)
}

/**
 * Updates a user's subscription
 * @param where SQL condition to match subscription record
 * @param data The data to update
 */
export async function updateUserSubscription(
  where: SQL,
  data: Partial<typeof UserSubscriptionTable.$inferInsert>
) {
  try {
    const [updatedSubscription] = await db
      .update(UserSubscriptionTable)
      .set(data)
      .where(where)
      .returning({
        id: UserSubscriptionTable.id,
        userId: UserSubscriptionTable.clerkUserId,
      })

    if (updatedSubscription != null) {
      revalidateDbCache({
        tag: CACHE_TAGS.subscription,
        userId: updatedSubscription.userId,
        id: updatedSubscription.id,
      })
    }
  } catch (error) {
    console.error("Failed to update user subscription:", error)
  }
}

/**
 * Gets a user's subscription tier, creating a default one if none exists
 * 
 * Note: For the betting analytics app, we automatically set users to the 
 * Premium tier to ensure they have full access to analytics features.
 * In a production environment, this would be handled through proper
 * subscription management.
 * 
 * @param userId The user ID to lookup
 * @returns The user's subscription tier object
 */
export async function getUserSubscriptionTier(userId: string) {
  let subscription = await getUserSubscription(userId)

  // Create a default Premium subscription if none exists (for development/demo)
  if (subscription == null) {
    try {
      console.log(`Creating default Premium subscription for user ${userId}`)
      subscription = await createUserSubscription({
        clerkUserId: userId,
        tier: "Premium", // Using Premium tier for the betting analytics app
      })
      
      // If for some reason the creation failed, fallback to a default Premium tier
      if (!subscription) {
        console.log("Failed to create subscription record, using default Premium tier fallback")
        // Return Premium tier directly to ensure app functionality
        return subscriptionTiers.Premium
      }
    } catch (error) {
      console.error("Error creating subscription:", error)
      // Return Premium tier directly to ensure app functionality
      return subscriptionTiers.Premium
    }
  }

  return subscriptionTiers[subscription.tier]
}

/**
 * Internal function to get a user's subscription from the database
 */
function getUserSubscriptionInternal(userId: string) {
  return db.query.UserSubscriptionTable.findFirst({
    where: ({ clerkUserId }, { eq }) => eq(clerkUserId, userId),
  })
}
