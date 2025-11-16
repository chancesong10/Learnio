// test_practice_exam.ts
import { createPracticeExam } from './practice_exam_creator';
async function test() {
    try {
        const exam = createPracticeExam({
            course: 'Matrix Algebra',
            topics: ['Linear Transformations', 'Determinants'],
            numQuestions: 5,
        });
        console.log('Generated Practice Exam:');
        console.log(exam);
    }
    catch (err) {
        console.error('Error:', err.message);
    }
}
test();
