export interface Example {
  id: string;
  number: number;
  title: string;
  tag: string;
  code: string;
  call: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'two-sum-ii',
    number: 167,
    title: 'Two Sum II - Input Array Is Sorted',
    tag: 'Two Pointers',
    code: `def twoSum(numbers: List[int], target: int) -> List[int]:
    left, right = 0, len(numbers) - 1
    while left < right:
        current_sum = numbers[left] + numbers[right]
        if current_sum == target:
            return [left + 1, right + 1]
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    return []
`,
    call: 'twoSum([1, 3, 4, 5, 7, 10, 11], 9)',
  },
  {
    id: 'move-zeroes',
    number: 283,
    title: 'Move Zeroes',
    tag: 'Fast & Slow Pointers',
    code: `def moveZeroes(nums: List[int]) -> List[int]:
    slow = 0
    for fast in range(len(nums)):
        if nums[fast] != 0:
            nums[slow], nums[fast] = nums[fast], nums[slow]
            slow += 1
    return nums
`,
    call: 'moveZeroes([0, 1, 0, 3, 12])',
  },
  {
    id: 'two-sum',
    number: 1,
    title: 'Two Sum',
    tag: 'Hash Map',
    code: `def twoSum(nums: List[int], target: int) -> List[int]:
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []
`,
    call: 'twoSum([3, 8, 11, 2, 15, 7], 9)',
  },
];
